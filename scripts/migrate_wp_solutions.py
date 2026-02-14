#!/usr/bin/env python3
"""Migrate Bloomwood Solutions pages from WP REST into Astro content.

- Fetches /solutions/wp-json/wp/v2/pages
- Converts HTML content to Markdown (basic, preserving headings/lists/links)
- Downloads referenced wp-content/uploads images into public/images/solutions/uploads/...
- Writes markdown into src/content/pages/solutions/... matching desired routes

Idempotent-ish: overwrites generated markdown files.
"""

from __future__ import annotations

import json
import os
import re
import sys
import textwrap
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, List, Optional, Tuple

WP_PAGES_ENDPOINT = "https://bloomwood.com.au/solutions/wp-json/wp/v2/pages?per_page=100&_fields=id,slug,title,link,parent,content,excerpt"
SITE_BASE = "https://bloomwood.com.au"

ROOT = Path(__file__).resolve().parents[1]
OUT_CONTENT = ROOT / "src" / "content" / "pages"
OUT_PUBLIC = ROOT / "public" / "images" / "solutions"

UPLOADS_RE = re.compile(r"https?://[^\s\"')]+?/wp-content/uploads/[^\s\"')]+", re.I)


def fetch_json(url: str) -> list:
    if not url.startswith(('http://', 'https://')):
        raise ValueError("URL must start with http:// or https://")
    with urllib.request.urlopen(url, timeout=30) as r:
        data = r.read().decode("utf-8")
    return json.loads(data)


def slug_to_route(slug: str, wp_link: str) -> str:
    """Return Astro content slug (path under pages collection) for the WP page."""
    if slug == "home":
        return "solutions"

    # Prefer using WP link path under /solutions/ to infer nesting.
    # Example: https://bloomwood.com.au/solutions/bookings/pricing/ => solutions/bookings/pricing
    if wp_link.rstrip("/") == "https://bloomwood.com.au/solutions":
        return "solutions"

    m = re.search(r"/solutions/(.+?)/?$", wp_link)
    if not m:
        return f"solutions/{slug}"
    path = m.group(1)
    path = path.strip("/")

    # Normalize some ugly WP slugs to nicer routes.
    path = path.replace("about-bloomwood-solutions", "about")
    path = path.replace("bloomwood-solutions-contact-us", "contact-us")
    path = path.replace("bloomwood-solutions-cookie-policy", "cookie-policy")

    if path == "":
        return "solutions"  # home

    return f"solutions/{path}"


def filename_for_content_slug(content_slug: str) -> Path:
    # We store solutions root as src/content/pages/solutions.md (existing convention).
    if content_slug == "solutions":
        return OUT_CONTENT / "solutions.md"
    return OUT_CONTENT / (content_slug + ".md")


def ensure_parent_dir(p: Path) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)


def md_escape_frontmatter(s: str) -> str:
    # Use YAML double-quoted strings; escape backslashes and quotes.
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    return s


def html_to_text_for_description(html: str) -> str:
    # remove tags quickly
    txt = re.sub(r"<[^>]+>", " ", html)
    txt = unescape(txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


@dataclass
class ImageRef:
    url: str
    local_rel: str  # /images/solutions/...
    local_path: Path


def plan_image_downloads(html: str) -> List[ImageRef]:
    urls = sorted(set(UPLOADS_RE.findall(html)))
    refs: List[ImageRef] = []
    for u in urls:
        # Keep path after /wp-content/uploads/
        m = re.search(r"/wp-content/uploads/(.+)$", u)
        if not m:
            continue
        tail = m.group(1)
        tail = tail.split("?")[0]
        local_path = OUT_PUBLIC / "uploads" / tail
        local_rel = f"/images/solutions/uploads/{tail}"
        refs.append(ImageRef(url=u, local_rel=local_rel, local_path=local_path))
    return refs


def download(url: str, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Skip if exists
    if out_path.exists() and out_path.stat().st_size > 0:
        return
    req = urllib.request.Request(url, headers={"User-Agent": "clawdbot-migrate/1.0"})
    if not url.startswith(('http://', 'https://')):
        raise ValueError("URL must start with http:// or https://")
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    out_path.write_bytes(data)


class HtmlToMarkdown(HTMLParser):
    """Very small HTML→Markdown converter tuned for WP page content."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: List[str] = []
        self.href_stack: List[Optional[str]] = []
        self.list_stack: List[str] = []  # 'ul' or 'ol'
        self.in_li = False
        self.in_pre = False
        self.skip_stack: List[str] = []
        self.pending_space = False

    def write(self, s: str):
        self.out.append(s)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)

        if tag in {"script", "style", "noscript"}:
            self.skip_stack.append(tag)
            return

        if self.skip_stack:
            return

        if tag in {"p", "div"}:
            self.write("\n\n")
        elif tag == "br":
            self.write("\n")
        elif tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            level = int(tag[1])
            self.write("\n\n" + ("#" * level) + " ")
        elif tag == "strong" or tag == "b":
            self.write("**")
        elif tag == "em" or tag == "i":
            self.write("*")
        elif tag == "a":
            self.href_stack.append(attrs.get("href"))
            self.write("[")
        elif tag in {"ul", "ol"}:
            self.list_stack.append(tag)
            self.write("\n")
        elif tag == "li":
            self.in_li = True
            indent = "  " * (len(self.list_stack) - 1)
            bullet = "- " if (self.list_stack and self.list_stack[-1] == "ul") else "1. "
            self.write("\n" + indent + bullet)
        elif tag == "img":
            src = (attrs.get("src") or "").strip()
            alt = unescape((attrs.get("alt") or "")).strip() or "Image"
            if src:
                self.write(f"![{self._escape_md_text(alt)}]({src})")
        elif tag == "pre":
            self.in_pre = True
            self.write("\n\n```\n")
        elif tag == "code":
            if not self.in_pre:
                self.write("`")

    def handle_endtag(self, tag):
        if self.skip_stack:
            if self.skip_stack[-1] == tag:
                self.skip_stack.pop()
            return

        if tag in {"strong", "b"}:
            self.write("**")
        elif tag in {"em", "i"}:
            self.write("*")
        elif tag == "a":
            href = self.href_stack.pop() if self.href_stack else None
            self.write("]")
            if href:
                self.write(f"({href})")
        elif tag in {"ul", "ol"}:
            if self.list_stack:
                self.list_stack.pop()
            self.write("\n")
        elif tag == "li":
            self.in_li = False
        elif tag == "pre":
            self.in_pre = False
            self.write("\n```\n")
        elif tag == "code":
            if not self.in_pre:
                self.write("`")

    def handle_data(self, data):
        if self.skip_stack:
            return
        if not data:
            return
        if self.in_pre:
            self.write(data)
            return
        txt = unescape(data)
        txt = re.sub(r"\s+", " ", txt)
        self.write(self._escape_md_text(txt))

    def handle_entityref(self, name):
        self.handle_data(f"&{name};")

    def handle_charref(self, name):
        self.handle_data(f"&#{name};")

    def _escape_md_text(self, s: str) -> str:
        # Avoid escaping too aggressively; just basic.
        s = s.replace("\u00a0", " ")
        return s

    def get_markdown(self) -> str:
        md = "".join(self.out)
        md = re.sub(r"\n{3,}", "\n\n", md)
        md = md.strip()
        # Fix weird img markdown created above if any.
        md = md.replace("![](", "![Image](")
        return md


def convert_html_to_md(html: str) -> str:
    # Strip some WP block comments
    html = re.sub(r"<!--\s*/?wp:[^>]*-->", "", html)
    # Remove empty paragraphs
    html = re.sub(r"<p>\s*</p>", "", html)

    p = HtmlToMarkdown()
    p.feed(html)
    return p.get_markdown()


def rewrite_links(md: str) -> str:
    # Rewrite absolute internal links from WP solutions to site relative.
    md = md.replace("https://bloomwood.com.au/solutions/", "/solutions/")
    md = md.replace("https://bloomwood.com.au/", "/")
    return md


def apply_image_rewrites(md: str, images: List[ImageRef]) -> str:
    for img in images:
        # Replace occurrences of the remote URL (with or without scheme variations)
        md = md.replace(img.url, img.local_rel)
    return md


def main() -> int:
    pages = fetch_json(WP_PAGES_ENDPOINT)

    wanted_slugs = {
        "home",
        "about-bloomwood-solutions",
        "bookings",
        "services",
        "service-area",
        "pricing",
        "terms-conditions",
        "pre-paid-service-packs",
        "bloomwood-solutions-contact-us",
        "urgent-requests",
        "privacy-policy",
        "bloomwood-solutions-cookie-policy",
        "social-media-policy",
        "website-terms-of-use",
    }

    selected = [p for p in pages if p.get("slug") in wanted_slugs]
    if not selected:
        print("No pages selected; check API")
        return 2

    # Download images and write markdown.
    for p in selected:
        title = unescape(p["title"]["rendered"]).strip()
        slug = p["slug"]
        link = p.get("link") or ""
        content_html = p.get("content", {}).get("rendered", "")
        excerpt_html = p.get("excerpt", {}).get("rendered", "")

        content_slug = slug_to_route(slug, link)
        out_file = filename_for_content_slug(content_slug)
        print(f"PROCESS {slug} -> {content_slug}", flush=True)
        ensure_parent_dir(out_file)

        images = plan_image_downloads(content_html)
        for img in images:
            try:
                download(img.url, img.local_path)
            except Exception as e:
                print(f"WARN: failed to download {img.url}: {e}")

        md_body = convert_html_to_md(content_html)
        md_body = rewrite_links(md_body)
        md_body = apply_image_rewrites(md_body, images)

        # Clean up some WP boilerplate.
        md_body = re.sub(r"\n{3,}", "\n\n", md_body).strip() + "\n"

        desc = html_to_text_for_description(excerpt_html) or html_to_text_for_description(content_html)
        if len(desc) > 160:
            desc = desc[:157].rstrip() + "..."

        frontmatter = "---\n" + f"title: \"{md_escape_frontmatter(title)}\"\n"
        if desc:
            frontmatter += f"description: \"{md_escape_frontmatter(desc)}\"\n"
        frontmatter += "---\n\n"

        out_file.write_text(frontmatter + md_body, encoding="utf-8")
        print(f"WROTE {out_file.relative_to(ROOT)}  ({content_slug})", flush=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
