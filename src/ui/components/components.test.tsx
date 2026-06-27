import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Button,
  IconButton,
  Card,
  Tag,
  SectionHeader,
  ProgressRing,
  BottomNav,
  PlaceholderImage,
} from "./index";

describe("Button", () => {
  it("renders as a button defaulting to type=button", () => {
    render(<Button>送信</Button>);
    const btn = screen.getByRole("button", { name: "送信" });
    expect(btn).toHaveAttribute("type", "button");
  });

  it("calls onClick when activated", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>押す</Button>);
    await userEvent.click(screen.getByRole("button", { name: "押す" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies variant and size classes", () => {
    render(
      <Button variant="accent" size="lg">
        予約
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "予約" });
    expect(btn.className).toContain("ek-btn--accent");
    expect(btn.className).toContain("ek-btn--lg");
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        無効
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "無効" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("exposes the required accessible name", () => {
    render(<IconButton label="お気に入りに追加" icon={<span>♥</span>} />);
    expect(
      screen.getByRole("button", { name: "お気に入りに追加" }),
    ).toBeInTheDocument();
  });
});

describe("Card", () => {
  it("wraps children in a padded body by default", () => {
    const { container } = render(<Card>中身</Card>);
    expect(container.querySelector(".ek-card__body")).not.toBeNull();
    expect(screen.getByText("中身")).toBeInTheDocument();
  });

  it("omits the body wrapper when padded is false", () => {
    const { container } = render(<Card padded={false}>素</Card>);
    expect(container.querySelector(".ek-card__body")).toBeNull();
  });
});

describe("Tag", () => {
  it("renders content with the requested tone class", () => {
    render(<Tag tone="accent">みかん</Tag>);
    const tag = screen.getByText("みかん");
    expect(tag.className).toContain("ek-tag--accent");
  });
});

describe("SectionHeader", () => {
  it("renders the title at the requested heading level", () => {
    render(<SectionHeader as="h1" eyebrow="EHIME" title="おすすめ" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "おすすめ" }),
    ).toBeInTheDocument();
  });
});

describe("ProgressRing", () => {
  it("exposes a progressbar with the rounded value", () => {
    render(<ProgressRing value={42.6} label="達成率" />);
    const bar = screen.getByRole("progressbar", { name: "達成率" });
    expect(bar).toHaveAttribute("aria-valuenow", "43");
    expect(screen.getByText("43%")).toBeInTheDocument();
  });

  it("clamps out-of-range values into 0–100", () => {
    const { rerender } = render(<ProgressRing value={-20} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    rerender(<ProgressRing value={180} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });
});

describe("BottomNav", () => {
  const items = [
    { id: "home", label: "ホーム", icon: <span>🏠</span> },
    { id: "map", label: "マップ", icon: <span>🗺️</span> },
  ];

  it("marks the active item with aria-current", () => {
    render(<BottomNav items={items} activeId="map" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "マップ" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("button", { name: "ホーム" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("invokes onSelect with the chosen id", async () => {
    const onSelect = vi.fn();
    render(<BottomNav items={items} activeId="home" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "マップ" }));
    expect(onSelect).toHaveBeenCalledWith("map");
  });
});

describe("PlaceholderImage", () => {
  it("renders an accessible image with label and sublabel in its name", () => {
    render(<PlaceholderImage motif="temple" label="石手寺" />);
    expect(
      screen.getByRole("img", { name: "石手寺（写真は準備中です）" }),
    ).toBeInTheDocument();
  });

  it("falls back to the sublabel when no label is given", () => {
    render(<PlaceholderImage sublabel="準備中" />);
    expect(screen.getByRole("img", { name: "準備中" })).toBeInTheDocument();
  });
});
