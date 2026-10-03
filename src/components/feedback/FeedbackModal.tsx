"use client";

import { useEffect, useId, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  DESCRIPTION_MAX,
  FEEDBACK_KINDS,
  FEEDBACK_LIMIT_PER_HOUR,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  SUBJECT_MAX,
  rateLimitMessage,
  type FeedbackKindValue,
  type FeedbackLimitStatus,
} from "@/lib/feedback";

const KIND_LABELS: Record<FeedbackKindValue, { label: string; hint: string }> = {
  BUG: { label: "Bug report", hint: "Something is broken or behaving oddly" },
  FEEDBACK: { label: "Feedback", hint: "An idea, a compliment, anything at all" },
};

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const SHRINK_MAX_EDGE = 1920;

const fieldClass =
  "w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 outline-none focus:border-primary";

interface Shot {
  id: number;
  file: File;
  url: string;
}

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Report a bug or send feedback" size="lg">
      {/* Mounted only while open, so every opening starts from a blank form. */}
      <FeedbackGate onClose={onClose} />
    </Modal>
  );
}

/**
 * Asks the server how many reports this visitor has left before showing the
 * form, so nobody writes a long report only to learn they can't send it. A
 * failed check just shows the form: the server enforces the limit regardless.
 */
function FeedbackGate({ onClose }: { onClose: () => void }) {
  const [limit, setLimit] = useState<FeedbackLimitStatus | "failed" | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check(): Promise<FeedbackLimitStatus | "failed"> {
      try {
        const res = await fetch("/api/feedback", { cache: "no-store" });
        return res.ok ? ((await res.json()) as FeedbackLimitStatus) : "failed";
      } catch {
        return "failed";
      }
    }
    void check().then((result) => {
      if (!cancelled) setLimit(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (limit === null) {
    return <p className="py-10 text-center text-muted">One moment...</p>;
  }

  if (limit !== "failed" && limit.remaining === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span
          aria-hidden
          // Inline: globals.css's unlayered `* { border-color }` beats border-<color> classes.
          style={{ borderColor: "var(--danger)" }}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 font-display text-2xl font-bold text-danger"
        >
          !
        </span>
        <p className="font-display text-xl font-semibold">You&apos;ve reached the limit</p>
        <p className="max-w-sm leading-relaxed text-muted">
          {rateLimitMessage(limit.retryAfterMinutes)}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <FeedbackForm
      onClose={onClose}
      remaining={limit === "failed" ? null : limit.remaining}
    />
  );
}

/**
 * Re-encodes a too-large screenshot as a downscaled JPEG so a retina
 * full-screen capture doesn't get bounced for size. GIFs are left alone
 * (re-encoding would drop the animation); resolves null if it can't help.
 */
async function shrinkImage(file: File): Promise<File | null> {
  if (file.type === "image/gif") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, SHRINK_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // JPEG has no alpha; paint white first so transparent areas aren't black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) return null;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function FeedbackForm({ onClose, remaining }: { onClose: () => void; remaining: number | null }) {
  const [kind, setKind] = useState<FeedbackKindValue>("BUG");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotError, setShotError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const errorBanner = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const baseId = useId();

  // Preview URLs are object URLs; free whatever is left when the form goes away.
  const shotsRef = useRef(shots);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => {
    return () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url));
  }, []);

  async function addFiles(incoming: File[]) {
    setShotError(null);
    let list = shotsRef.current;
    const added: Shot[] = [];
    let problem: string | null = null;

    for (const original of incoming) {
      if (list.length + added.length >= MAX_ATTACHMENTS) {
        problem = `You can attach up to ${MAX_ATTACHMENTS} screenshots.`;
        break;
      }
      if (!ACCEPTED_TYPES.includes(original.type)) {
        problem = "Screenshots must be PNG, JPEG, GIF or WebP images.";
        continue;
      }
      let file = original;
      if (file.size > MAX_ATTACHMENT_BYTES) {
        const shrunk = await shrinkImage(file);
        if (!shrunk || shrunk.size > MAX_ATTACHMENT_BYTES) {
          problem = `"${original.name}" is too large (${formatSize(original.size)}). The limit is 2 MB each.`;
          continue;
        }
        file = shrunk;
      }
      const total = [...list, ...added].reduce((sum, s) => sum + s.file.size, 0);
      if (total + file.size > MAX_TOTAL_ATTACHMENT_BYTES) {
        problem = "Those screenshots together are too large. Try fewer or smaller ones.";
        continue;
      }
      added.push({ id: nextId.current++, file, url: URL.createObjectURL(file) });
    }

    list = [...shotsRef.current, ...added];
    shotsRef.current = list;
    setShots(list);
    setShotError(problem);
  }

  function removeShot(id: number) {
    const target = shotsRef.current.find((s) => s.id === id);
    if (target) URL.revokeObjectURL(target.url);
    const list = shotsRef.current.filter((s) => s.id !== id);
    shotsRef.current = list;
    setShots(list);
    setShotError(null);
  }

  // Pasting a screenshot straight into the form works too.
  function handlePaste(e: ClipboardEvent<HTMLFormElement>) {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) {
      e.preventDefault();
      void addFiles(files);
    }
  }

  // The banner sits below a long form; make sure a failed send is actually seen.
  function showError() {
    requestAnimationFrame(() =>
      errorBanner.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    setError(null);
    setStatus("sending");

    const body = new FormData(e.currentTarget); // kind, subject, description, honeypot
    // Just the path: query strings can carry things that don't belong in a report.
    body.set("pageUrl", window.location.pathname);
    body.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    shots.forEach((s) => body.append("screenshots", s.file, s.file.name));

    try {
      const res = await fetch("/api/feedback", { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Something went wrong sending that. Please try again.");
        setStatus("idle");
        showError();
        return;
      }
      setStatus("sent");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setStatus("idle");
      showError();
    }
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-success text-2xl text-success"
        >
          ✓
        </span>
        <p className="font-display text-xl font-semibold">Thank you!</p>
        <p className="max-w-sm leading-relaxed text-muted">
          Your {kind === "BUG" ? "bug report" : "feedback"} has been received. It really does help make Geodex better.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Close
        </button>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form onSubmit={handleSubmit} onPaste={handlePaste} className="flex flex-col gap-5">
      <p className="leading-relaxed text-muted">
        Found a bug, or just want to tell us something? Send a bug report or feedback about
        anything at all and it goes straight to the developer.
      </p>

      <p className="rounded-lg border border-border-strong bg-surface-2/70 px-3.5 py-2.5 text-sm leading-snug">
        <span className="font-semibold">
          You can send up to {FEEDBACK_LIMIT_PER_HOUR} reports per hour.
        </span>
        {remaining !== null && remaining < FEEDBACK_LIMIT_PER_HOUR && (
          <span className="font-semibold text-danger"> You have {remaining} left right now.</span>
        )}
      </p>

      <div role="radiogroup" aria-label="What are you sending?" className="grid gap-3 sm:grid-cols-2">
        {FEEDBACK_KINDS.map((value) => {
          const active = kind === value;
          return (
            <label
              key={value}
              className={`relative flex cursor-pointer flex-col gap-0.5 rounded-xl border-2 px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-primary/50 ${
                active
                  ? "border-accent-strong bg-surface-2"
                  : "border-border bg-surface/40 hover:bg-surface-2/60"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={active}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              <span className="font-display font-semibold">{KIND_LABELS[value].label}</span>
              <span className="text-sm text-muted">{KIND_LABELS[value].hint}</span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${baseId}-subject`} className="text-sm font-medium">
          Subject
        </label>
        <input
          id={`${baseId}-subject`}
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={SUBJECT_MAX}
          required
          minLength={3}
          className={fieldClass}
        />
        <span className="self-end text-xs text-muted-2">
          {subject.length}/{SUBJECT_MAX}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${baseId}-description`} className="text-sm font-medium">
          Description
        </label>
        <textarea
          id={`${baseId}-description`}
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          required
          minLength={10}
          rows={6}
          className={`${fieldClass} resize-y`}
        />
        <span className="self-end text-xs text-muted-2">
          {description.length}/{DESCRIPTION_MAX}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            Screenshots <span className="font-normal text-muted">(optional)</span>
          </span>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={shots.length >= MAX_ATTACHMENTS}
            className="rounded-lg border border-border-strong px-3 py-1.5 text-sm transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add screenshot
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []));
            e.target.value = ""; // so picking the same file again still fires
          }}
        />
        <p className="text-xs text-muted-2">
          Up to {MAX_ATTACHMENTS} images (PNG, JPEG, GIF or WebP, 2 MB each). You can also paste
          one straight into this form.
        </p>

        {shots.length > 0 && (
          <ul className="grid grid-cols-3 gap-3">
            {shots.map((s) => (
              <li
                key={s.id}
                className="group relative overflow-hidden rounded-lg border border-border bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt={`Screenshot: ${s.file.name}`} className="h-24 w-full object-cover" />
                <span className="block truncate px-2 py-1 text-xs text-muted">
                  {formatSize(s.file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeShot(s.id)}
                  aria-label={`Remove ${s.file.name}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-xs text-white transition-colors hover:bg-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {shotError && (
          <p role="alert" className="text-sm text-danger">
            {shotError}
          </p>
        )}
      </div>

      {/* Honeypot: invisible to people, tempting to bots. The server drops
          any submission that fills it in. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <p className="text-xs leading-relaxed text-muted-2">
        Your browser type and screen size are sent along to help us reproduce problems. If
        you&apos;re signed in, we also see which account it came from.
      </p>

      {error && (
        <div
          ref={errorBanner}
          role="alert"
          style={{ borderColor: "var(--danger)" }}
          className="flex items-start gap-3 rounded-xl border-2 bg-danger/10 px-4 py-3"
        >
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger font-display text-sm font-bold text-white"
          >
            !
          </span>
          <p className="font-semibold leading-snug text-danger">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border-strong px-4 py-2.5 transition-colors hover:bg-surface-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}
