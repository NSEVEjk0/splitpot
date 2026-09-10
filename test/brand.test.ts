import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter, SiteHeader } from "@/components/Brand";

const HANDLE = "@ckay";
const X_URL = "https://x.com/CRYPTFRANI";
const MOOVE_URL = "https://www.moove.xyz/@ckay";

describe("branding appears on every page", () => {
  it("renders the handle, the X link and the moove profile in the header", () => {
    const html = renderToStaticMarkup(createElement(SiteHeader));
    expect(html).toContain(HANDLE);
    expect(html).toContain(`href="${X_URL}"`);
    expect(html).toContain(`href="${MOOVE_URL}"`);
  });

  it("renders the handle, the X link and the built-by line in the footer", () => {
    const html = renderToStaticMarkup(createElement(SiteFooter));
    expect(html).toContain(HANDLE);
    expect(html).toContain(`href="${X_URL}"`);
    expect(html).toContain(`href="${MOOVE_URL}"`);
    expect(html).toContain("Built by @ckay");
    expect(html).toContain(X_URL);
  });

  it("states the settlement story in the footer copy", () => {
    const html = renderToStaticMarkup(createElement(SiteFooter));
    expect(html).toContain("Split any bill.");
    expect(html).toContain("any token on any chain");
    expect(html).toContain(`settles to ${HANDLE} on Moove`);
  });
});
