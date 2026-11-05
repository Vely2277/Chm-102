from pathlib import Path
import re

target = Path("physics 104 answers and explanations.txt")
rich_path = Path("new physics file.txt")

old_text = target.read_text(encoding="utf-8")
rich_text = rich_path.read_text(encoding="utf-8")

old_records = []
for line in old_text.splitlines():
    match = re.match(r"^\s*(\d+)\.\s+(.*)$", line)
    if match:
        old_records.append((int(match.group(1)), match.group(2).strip()))

rich_markers = list(re.finditer(r"(?m)^\s*NUMBER:\s*(\d+)\s*$", rich_text))
rich_records = []
for index, marker in enumerate(rich_markers):
    end = rich_markers[index + 1].start() if index + 1 < len(rich_markers) else len(rich_text)
    block = rich_text[marker.start():end].strip()
    answer_match = re.search(r"(?mi)^\s*Answer:\s*([A-E])\b", block)
    explanation_match = re.search(
        r"(?mis)^\s*(Explanation(?:\s*&\s*Problem-Solving Strategy)?\s*:.*)$",
        block,
    )
    if not answer_match or not explanation_match or not explanation_match.group(1).strip():
        raise ValueError(f"Malformed rich record at source number {marker.group(1)}")
    explanation = re.sub(
        r"(?mi)^[ \t]*(?:TEST|EXAMINATION) REVISION GUIDE[ \t]*$\n?", "", explanation_match.group(1)
    ).strip()
    rich_records.append((answer_match.group(1).upper(), explanation))

if len(old_records) != 200 or len(rich_records) != 200:
    raise ValueError(f"Expected 200 records in each file, got {len(old_records)} and {len(rich_records)}")

merged_records = []
conflicts = []
for index, (display_number, old_body) in enumerate(old_records):
    rich_index = index if index < 120 else min(index + 1, 199)
    rich_answer, rich_explanation = rich_records[rich_index]

    answer_match = re.search(r"(?i)\bAnswer:\s*(.*?)(?=\s+Explanation:|$)", old_body)
    if not answer_match:
        raise ValueError(f"Missing existing answer context for record {display_number}")
    old_answer_text = answer_match.group(1).strip()
    old_letter_match = re.match(r"\s*([A-E])\s*\)", old_answer_text, re.I)
    old_letter = old_letter_match.group(1).upper() if old_letter_match else None
    if old_letter and old_letter != rich_answer:
        conflicts.append((display_number, old_letter, rich_answer))

    if old_letter_match:
        answer_context = re.sub(
            r"^\s*[A-E]\s*\)", f"{rich_answer})", old_answer_text, count=1, flags=re.I
        )
    else:
        answer_context = f"{rich_answer}) {old_answer_text}"

    question_context = old_body.split("Answer:", 1)[0].rstrip()
    merged_records.append(
        f"{display_number}. {question_context}Answer: {answer_context}\n{rich_explanation}"
    )

output = [
    "PHYSICS 104 ANSWERS AND EXPLANATIONS",
    "",
    "TEST REVISION GUIDE",
    "",
    "\n\n".join(merged_records[:120]),
    "",
    "EXAMINATION REVISION GUIDE",
    "",
    "\n\n".join(merged_records[120:]),
    "",
]
merged_text = "\n".join(output)
if len(re.findall(r"(?m)^[ \t]*TEST REVISION GUIDE[ \t]*$", merged_text)) != 1:
    raise ValueError("TEST REVISION GUIDE heading validation failed")
if len(re.findall(r"(?m)^[ \t]*EXAMINATION REVISION GUIDE[ \t]*$", merged_text)) != 1:
    raise ValueError("EXAMINATION REVISION GUIDE heading validation failed")
if len(re.findall(r"(?m)^\s*\d+\.\s+", merged_text)) != 200:
    raise ValueError("Merged record count validation failed")
if len(re.findall(r"(?mi)\bAnswer:\s*[A-E]\b", merged_text)) != 200:
    raise ValueError("Merged answer count validation failed")
if len(re.findall(r"(?mi)^\s*Explanation(?:\s*&\s*Problem-Solving Strategy)?\s*:\s*\S", merged_text)) != 200:
    raise ValueError("Merged explanation count validation failed")

target.write_text(merged_text, encoding="utf-8")
print(f"records=200 answers=200 explanations=200 conflicts={len(conflicts)}")
for number, old_letter, rich_letter in conflicts:
    section = "TEST" if number <= 120 else "EXAMINATION"
    print(f"conflict {section} item {number}: existing={old_letter} rich={rich_letter}")