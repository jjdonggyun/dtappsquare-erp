from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION_START
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "ERP-사용자-가이드.md"
OUTPUT = ROOT / "output" / "phase6" / "디지털스퀘어_ERP_사용자_가이드.docx"


def set_cell_fill(cell, color: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), color)


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run()
    fld_char = OxmlElement("w:fldChar")
    fld_char.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = "PAGE"
    fld_char_end = OxmlElement("w:fldChar")
    fld_char_end.set(qn("w:fldCharType"), "end")
    run._r.extend([fld_char, instr_text, fld_char_end])


def add_inline(paragraph, text: str) -> None:
    parts = re.split(r"(\*\*.+?\*\*|`.+?`)", text)
    for part in parts:
        if part.startswith("**") and part.endswith("**"):
            paragraph.add_run(part[2:-2]).bold = True
        elif part.startswith("`") and part.endswith("`"):
            run = paragraph.add_run(part[1:-1])
            run.font.name = "Consolas"
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(31, 78, 121)
        else:
            paragraph.add_run(part)


def parse_table(lines: list[str], start: int) -> tuple[list[list[str]], int]:
    rows: list[list[str]] = []
    index = start
    while index < len(lines) and lines[index].strip().startswith("|"):
        cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
        if not all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            rows.append(cells)
        index += 1
    return rows, index


def add_table(document: Document, rows: list[list[str]]) -> None:
    if not rows:
        return
    column_count = max(len(row) for row in rows)
    table = document.add_table(rows=len(rows), cols=column_count)
    table.style = "Table Grid"
    for row_index, row in enumerate(rows):
        for column_index in range(column_count):
            cell = table.cell(row_index, column_index)
            cell.text = row[column_index] if column_index < len(row) else ""
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after = Pt(0)
                for run in paragraph.runs:
                    run.font.name = "맑은 고딕"
                    run.font.size = Pt(8.5)
                    if row_index == 0:
                        run.bold = True
                        run.font.color.rgb = RGBColor(255, 255, 255)
            if row_index == 0:
                set_cell_fill(cell, "1F4E78")


def configure_styles(document: Document) -> None:
    normal = document.styles["Normal"]
    normal.font.name = "맑은 고딕"
    normal.font.size = Pt(9.5)
    normal.font.color.rgb = RGBColor(34, 48, 65)
    normal.paragraph_format.space_after = Pt(5)
    normal.paragraph_format.line_spacing = 1.2
    for name, size, color in [
        ("Title", 28, "102A43"),
        ("Heading 1", 17, "102A43"),
        ("Heading 2", 12, "1F4E78"),
        ("Heading 3", 10, "1F4E78"),
    ]:
        style = document.styles[name]
        style.font.name = "맑은 고딕"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.space_before = Pt(10)
        style.paragraph_format.space_after = Pt(5)


def build() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    document = Document()
    configure_styles(document)
    section = document.sections[0]
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(1.9)
    section.right_margin = Cm(1.9)
    section.header_distance = Cm(0.8)
    section.footer_distance = Cm(0.8)

    header = section.header.paragraphs[0]
    header.text = "DIGITAL SQUARE · ERP USER GUIDE"
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    header.runs[0].font.name = "맑은 고딕"
    header.runs[0].font.size = Pt(7.5)
    header.runs[0].font.color.rgb = RGBColor(101, 116, 139)
    add_page_number(section.footer.paragraphs[0])

    title = document.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(130)
    title_run = title.add_run("디지털스퀘어 ERP")
    title_run.font.name = "맑은 고딕"
    title_run.font.size = Pt(31)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(16, 42, 67)
    subtitle = document.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle_run = subtitle.add_run("사용자 · 테스트 가이드")
    subtitle_run.font.name = "맑은 고딕"
    subtitle_run.font.size = Pt(18)
    subtitle_run.font.bold = True
    subtitle_run.font.color.rgb = RGBColor(31, 78, 121)
    meta = document.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.paragraph_format.space_before = Pt(25)
    meta.add_run("Phase 6 운영 산출물\n2026-09-28\n처음 사용하는 직원 · 관리자 · 테스트 담당자용")
    for run in meta.runs:
        run.font.name = "맑은 고딕"
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(82, 97, 115)
    document.add_page_break()

    toc = document.add_paragraph("이 문서에서 다루는 내용", style="Heading 1")
    toc.paragraph_format.space_after = Pt(10)
    for line in lines:
        if line.startswith("## "):
            paragraph = document.add_paragraph(style="List Number")
            paragraph.add_run(re.sub(r"^\d+\.\s*", "", line[3:])).font.name = "맑은 고딕"
    document.add_page_break()

    index = 0
    in_code = False
    code_lines: list[str] = []
    while index < len(lines):
        raw = lines[index]
        stripped = raw.strip()
        if stripped.startswith("# "):
            index += 1
            continue
        if stripped.startswith("```"):
            if not in_code:
                in_code = True
                code_lines = []
            else:
                paragraph = document.add_paragraph()
                paragraph.paragraph_format.left_indent = Cm(0.5)
                paragraph.paragraph_format.right_indent = Cm(0.5)
                paragraph.paragraph_format.space_before = Pt(3)
                paragraph.paragraph_format.space_after = Pt(7)
                run = paragraph.add_run("\n".join(code_lines))
                run.font.name = "Consolas"
                run.font.size = Pt(7.5)
                run.font.color.rgb = RGBColor(34, 48, 65)
                paragraph._p.get_or_add_pPr().append(OxmlElement("w:shd"))
                paragraph._p.pPr[-1].set(qn("w:fill"), "F2F5F8")
                in_code = False
            index += 1
            continue
        if in_code:
            code_lines.append(raw)
            index += 1
            continue
        if stripped.startswith("|") and index + 1 < len(lines) and lines[index + 1].strip().startswith("|"):
            rows, index = parse_table(lines, index)
            add_table(document, rows)
            continue
        if stripped.startswith("## "):
            document.add_paragraph(stripped[3:], style="Heading 1")
        elif stripped.startswith("### "):
            document.add_paragraph(stripped[4:], style="Heading 2")
        elif re.match(r"^\d+\.\s+", stripped):
            paragraph = document.add_paragraph(style="List Paragraph")
            add_inline(paragraph, stripped)
        elif stripped.startswith("- "):
            paragraph = document.add_paragraph(style="List Bullet")
            add_inline(paragraph, stripped[2:])
        elif stripped:
            paragraph = document.add_paragraph()
            add_inline(paragraph, stripped.replace("  ", " "))
        index += 1

    final_section = document.add_section(WD_SECTION_START.NEW_PAGE)
    final_section.top_margin = Cm(2.2)
    paragraph = document.add_paragraph("문서 관리", style="Heading 1")
    document.add_paragraph("원문: docs/ERP-사용자-가이드.md")
    document.add_paragraph("운영 절차: docs/operations-runbook.md")
    document.add_paragraph("이슈 접수: output/phase6/ERP_Codex_이슈_관리.xlsx")
    document.add_paragraph("기능·권한·화면이 변경되면 원문과 Word 산출물을 함께 갱신합니다.")
    document.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
