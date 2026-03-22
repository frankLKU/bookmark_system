#!/usr/bin/env python3
"""
Memory Cleanup Script — 180-Day Pruning & Knowledge Extraction

Scans .claude_memories/ for daily logs older than 180 days.
Extracts permanent knowledge into CHRONICLES.md, then archives the originals.
"""

import os
import re
import shutil
from datetime import datetime, timedelta
from pathlib import Path

MEMORIES_DIR = Path(__file__).resolve().parent.parent / ".claude_memories"
ARCHIVE_DIR = MEMORIES_DIR / "archive"
CHRONICLES = MEMORIES_DIR / "CHRONICLES.md"
CUTOFF_DAYS = 180

# Match daily log files: YYYY-MM-DD.md
DATE_PATTERN = re.compile(r"^(\d{4}-\d{2}-\d{2})\.md$")


def find_old_logs(cutoff: datetime) -> list[Path]:
    """Find daily log files older than the cutoff date."""
    old_logs = []
    for f in MEMORIES_DIR.iterdir():
        match = DATE_PATTERN.match(f.name)
        if match:
            file_date = datetime.strptime(match.group(1), "%Y-%m-%d")
            if file_date < cutoff:
                old_logs.append(f)
    return sorted(old_logs)


def extract_knowledge(log_path: Path) -> list[str]:
    """Extract key knowledge bullets from a daily log."""
    content = log_path.read_text(encoding="utf-8")
    bullets = []

    # Extract from known sections
    sections_to_extract = [
        "Technical Decisions & Why",
        "Technical Decisions",
        "New Environment Variables/Config Added",
        "New Environment Variables",
        "Key Decisions",
    ]

    lines = content.split("\n")
    in_target_section = False
    for line in lines:
        stripped = line.strip()

        # Check if we entered a target section
        if stripped.startswith("#"):
            header_text = stripped.lstrip("#").strip().strip("[]")
            in_target_section = any(s in header_text for s in sections_to_extract)
            continue

        # Collect bullet points from target sections
        if in_target_section and stripped.startswith("-"):
            bullets.append(stripped)

    return bullets


def append_to_chronicles(date_str: str, bullets: list[str]) -> None:
    """Append extracted knowledge to CHRONICLES.md."""
    if not bullets:
        return

    entry = f"\n## Extracted from {date_str}\n"
    entry += "\n".join(bullets) + "\n"

    with open(CHRONICLES, "a", encoding="utf-8") as f:
        f.write(entry)


def archive_log(log_path: Path) -> None:
    """Move a daily log to the archive directory."""
    ARCHIVE_DIR.mkdir(exist_ok=True)
    dest = ARCHIVE_DIR / log_path.name
    shutil.move(str(log_path), str(dest))


def main():
    cutoff = datetime.now() - timedelta(days=CUTOFF_DAYS)
    old_logs = find_old_logs(cutoff)

    if not old_logs:
        print(f"No logs older than {CUTOFF_DAYS} days found. Nothing to clean up.")
        return

    print(f"Found {len(old_logs)} log(s) older than {CUTOFF_DAYS} days.")

    for log_path in old_logs:
        date_str = log_path.stem
        print(f"  Processing {log_path.name}...")

        # Extract permanent knowledge
        bullets = extract_knowledge(log_path)
        if bullets:
            append_to_chronicles(date_str, bullets)
            print(f"    Extracted {len(bullets)} knowledge item(s) to CHRONICLES.md")
        else:
            print(f"    No extractable knowledge found")

        # Archive the original
        archive_log(log_path)
        print(f"    Archived to {ARCHIVE_DIR / log_path.name}")

    print("Cleanup complete.")


if __name__ == "__main__":
    main()
