import { describe, expect, it } from "vitest";
import {
  checkEmailDomain,
  domainCanReceiveMail,
  emailDomain,
  isDisposableDomain,
  type MxResolver,
} from "./emailDomain";

const withMx: MxResolver = async () => [{ exchange: "mx.example.com", priority: 10 }];
const failing = (code: string): MxResolver => async () => {
  throw Object.assign(new Error(code), { code });
};

describe("emailDomain", () => {
  it("takes the part after the last @, lowercased", () => {
    expect(emailDomain("Someone@Gmail.COM")).toBe("gmail.com");
    expect(emailDomain("a@b@yahoo.com")).toBe("yahoo.com");
    expect(emailDomain("x@mail.example.org.")).toBe("mail.example.org");
  });

  it("rejects shapes with no usable domain", () => {
    expect(emailDomain("nobody")).toBeNull();
    expect(emailDomain("@gmail.com")).toBeNull();
    expect(emailDomain("me@localhost")).toBeNull();
  });
});

describe("isDisposableDomain", () => {
  it("flags throwaway services and their subdomains", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    expect(isDisposableDomain("anything.mailinator.com")).toBe(true);
    expect(isDisposableDomain("gmail.com")).toBe(false);
    // A real domain that merely ends with the same letters isn't a match.
    expect(isDisposableDomain("notmailinator.com")).toBe(false);
  });
});

describe("domainCanReceiveMail", () => {
  it("accepts a domain with an MX record", async () => {
    expect(await domainCanReceiveMail("gmail.com", withMx)).toBe(true);
  });

  it("rejects domains DNS says have no mail or don't exist", async () => {
    expect(await domainCanReceiveMail("poop.com", failing("ENODATA"))).toBe(false);
    expect(await domainCanReceiveMail("nope.invalid", failing("ENOTFOUND"))).toBe(false);
  });

  it("rejects a null MX, which means 'no mail here'", async () => {
    expect(await domainCanReceiveMail("x.com", async () => [{ exchange: ".", priority: 0 }])).toBe(false);
    expect(await domainCanReceiveMail("x.com", async () => [])).toBe(false);
  });

  it("lets the address through when DNS itself is failing", async () => {
    expect(await domainCanReceiveMail("gmail.com", failing("ETIMEOUT"))).toBe(true);
    expect(await domainCanReceiveMail("gmail.com", failing("ESERVFAIL"))).toBe(true);
  });
});

describe("checkEmailDomain", () => {
  it("returns the reason an address is refused", async () => {
    expect(await checkEmailDomain("a@gmail.com", withMx)).toEqual({ ok: true });
    expect(await checkEmailDomain("a@mailinator.com", withMx)).toEqual({ ok: false, reason: "disposable" });
    expect(await checkEmailDomain("a@poop.com", failing("ENODATA"))).toEqual({
      ok: false,
      reason: "no-mail-server",
    });
    expect(await checkEmailDomain("nonsense", withMx)).toEqual({ ok: false, reason: "invalid" });
  });
});
