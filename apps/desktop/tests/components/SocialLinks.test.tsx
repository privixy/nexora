import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SocialLinks } from "@/components/SocialLinks";
import { SOCIAL_LINKS } from "@/config/socialLinks";
import { LINKS } from "@/config/links";

describe("SOCIAL_LINKS", () => {
  it("does not expose owner or social links after rebrand", () => {
    expect(SOCIAL_LINKS).toEqual([]);
    expect(LINKS).toEqual({});
  });
});

describe("SocialLinks", () => {
  it("renders no social buttons", () => {
    render(<SocialLinks />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
