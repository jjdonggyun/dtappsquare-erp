from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION_START
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "ERP-통합-테스트-시나리오.md"
OUTPUT = ROOT / "output" / "phase6" / "디지털스퀘어_ERP_전체_통합_테스트_시나리오.docx"


def set_cell_fill(cell, color: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), color)


def set_cell_margins(cell, top: int = 90, start: int = 100, bottom: int = 90, end: int = 100) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def prevent_row_split(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    cant_split.set(qn("w:val"), "true")
    tr_pr.append(cant_split)


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instruction = OxmlElement("w:instrText")
    instruction.set(qn("xml:space"), "preserve")
    instruction.text = "PAGE"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instruction, end])


def add_inline(paragraph, text: str) -> None:
    for part in re.split(r"(\*\*.+?\*\*|`.+?`)", text):
        if part.startswith("**") and part.endswith("**"):
            paragraph.add_run(part[2:-2]).bold = True
        elif part.startswith("`") and part.endswith("`"):
            run = paragraph.add_run(part[1:-1])
            run.font.name = "Consolas"
            run.font.size = Pt(9)
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


def table_widths(column_count: int) -> list[float]:
    if column_count == 4:
        return [1.5, 2.0, 7.4, 6.2]
    if column_count == 3:
        return [3.2, 5.0, 8.9]
    return [17.1 / column_count] * column_count


def add_table(document: Document, rows: list[list[str]]) -> None:
    if not rows:
        return
    column_count = max(len(row) for row in rows)
    widths = table_widths(column_count)
    table = document.add_table(rows=len(rows), cols=column_count)
    table.autofit = False
    table.style = "Table Grid"
    repeat_table_header(table.rows[0])
    for row_index, row in enumerate(rows):
        prevent_row_split(table.rows[row_index])
        for column_index in range(column_count):
            cell = table.cell(row_index, column_index)
            cell.width = Cm(widths[column_index])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)
            cell.text = row[column_index] if column_index < len(row) else ""
            if row_index == 0:
                set_cell_fill(cell, "1F4E78")
            elif row_index % 2 == 0:
                set_cell_fill(cell, "F4F7FA")
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after = Pt(0)
                paragraph.paragraph_format.line_spacing = 1.05
                if row_index == 0:
                    paragraph.paragraph_format.keep_with_next = True
                if column_index in (0, 1):
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in paragraph.runs:
                    run.font.name = "맑은 고딕"
                    run.font.size = Pt(8.2)
                    if row_index == 0:
                        run.bold = True
                        run.font.color.rgb = RGBColor(255, 255, 255)
    document.add_paragraph().paragraph_format.space_after = Pt(1)


def configure_styles(document: Document) -> None:
    normal = document.styles["Normal"]
    normal.font.name = "맑은 고딕"
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor(34, 48, 65)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.18
    for name, size in (("Title", 27), ("Heading 1", 16), ("Heading 2", 12), ("Heading 3", 10.5)):
        style = document.styles[name]
        style.font.name = "맑은 고딕"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.space_before = Pt(12)
        style.paragraph_format.space_after = Pt(6)


def build() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    document = Document()
    configure_styles(document)
    section = document.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Cm(1.7)
    section.bottom_margin = Cm(1.7)
    section.left_margin = Cm(1.9)
    section.right_margin = Cm(1.9)
    section.header_distance = Cm(0.7)
    section.footer_distance = Cm(0.7)

    header = section.header.paragraphs[0]
    header.text = "DIGITAL SQUARE ERP INTEGRATED TEST"
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in header.runs:
        run.font.name = "Arial"
        run.font.size = Pt(7.5)
        run.font.color.rgb = RGBColor(90, 90, 90)
    add_page_number(section.footer.paragraphs[0])

    title = document.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(122)
    title.add_run("디지털스퀘어 ERP\n전체 통합 테스트 시나리오")
    subtitle = document.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_before = Pt(18)
    subtitle_run = subtitle.add_run("직원 등록부터 프로젝트 마감과 세금계산서 발행까지")
    subtitle_run.font.name = "맑은 고딕"
    subtitle_run.font.size = Pt(15)
    subtitle_run.font.bold = True
    subtitle_run.font.color.rgb = RGBColor(0, 0, 0)
    meta = document.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.paragraph_format.space_before = Pt(28)
    meta.add_run("2026년 9월 28일\n관리자 직원 영업 프로젝트 재무 통합 검증용")
    for run in meta.runs:
        run.font.name = "맑은 고딕"
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(82, 82, 82)
    document.add_page_break()

    document.add_paragraph("목차", style="Heading 1")
    for line in lines:
        if line.startswith("## "):
            paragraph = document.add_paragraph(style="List Paragraph")
            paragraph.add_run(line[3:])
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
                paragraph.paragraph_format.left_indent = Cm(0.4)
                paragraph.paragraph_format.right_indent = Cm(0.4)
                paragraph.paragraph_format.space_before = Pt(4)
                paragraph.paragraph_format.space_after = Pt(8)
                run = paragraph.add_run("\n".join(code_lines))
                run.font.name = "Consolas"
                run.font.size = Pt(7.8)
                shd = OxmlElement("w:shd")
                shd.set(qn("w:fill"), "F2F5F8")
                paragraph._p.get_or_add_pPr().append(shd)
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
            heading_text = stripped[3:]
            phase_match = re.match(r"^단계\s+(\d+)\s+(.+)$", heading_text)
            if phase_match:
                heading_text = f"[단계 {phase_match.group(1)}] {phase_match.group(2)}"
            paragraph = document.add_paragraph(heading_text, style="Heading 1")
            if phase_match and phase_match.group(1) != "1":
                paragraph.paragraph_format.page_break_before = True
            if phase_match:
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif stripped.startswith("### "):
            document.add_paragraph(stripped[4:], style="Heading 2")
        elif re.match(r"^\d+\.\s+", stripped):
            paragraph = document.add_paragraph(style="List Paragraph")
            paragraph.paragraph_format.left_indent = Cm(0.5)
            add_inline(paragraph, stripped)
        elif stripped.startswith("- "):
            paragraph = document.add_paragraph(style="List Bullet")
            add_inline(paragraph, stripped[2:])
        elif stripped:
            paragraph = document.add_paragraph()
            add_inline(paragraph, stripped.replace("  ", " "))
        index += 1

    final_section = document.add_section(WD_SECTION_START.NEW_PAGE)
    final_section.page_width = Inches(8.5)
    final_section.page_height = Inches(11)
    final_section.top_margin = Cm(2.0)
    document.add_paragraph("테스트 종료 기록", style="Heading 1")
    document.add_paragraph("최종 결과는 Excel 통합 시나리오 시트와 이슈 목록에 기록한다.")
    document.add_paragraph("실패한 단계는 수정 후 같은 역할과 같은 입력 조건으로 재검증한다.")
    document.add_paragraph("세금계산서 실제 발급은 재무 담당자의 승인된 홈택스 또는 ASP 절차로만 수행한다.")
    document.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
