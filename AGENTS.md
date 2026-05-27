# Project Encoding Rules

This project may contain Chinese source text or generated Chinese output.
Preserve the following rules for all work in this directory.

## Encoding

- Keep source files and generated text files in UTF-8.
- Do not convert BOM or line-ending style merely for cleanup. Preserve the
  existing style of a file unless a requested change requires otherwise.
- Python text reads and writes must specify `encoding="utf-8"` or
  `encoding="utf-8-sig"` when intentionally accepting an existing BOM.
- HTML pages must retain `<meta charset="UTF-8">`.

## PowerShell On Windows

- Windows PowerShell 5.1 can read UTF-8 files without a BOM using the wrong
  legacy encoding.
- When reading text with PowerShell, always specify UTF-8 explicitly, for
  example: `Get-Content -LiteralPath 'file.py' -Encoding UTF8`.
- Do not overwrite source files using default-encoding PowerShell commands such
  as bare `Set-Content`, `Out-File`, or `>` / `>>`.
- Prefer patch-based edits for manual source changes.

## Verification

- After editing code or regenerating textual output, run:
  `python check_encoding.py`
- Treat an encoding-check failure as a blocker before delivering changes.
- When checking displayed Chinese content, distinguish terminal rendering
  problems from actual on-disk file corruption by decoding file bytes as UTF-8.

