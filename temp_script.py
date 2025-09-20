from pathlib import Path
path = Path("components/ui/ThreeBackground.tsx")
text = path.read_text(encoding="utf-8")
text = text.replace('    if (reducedMotion) {\n      return;\n    }\n', '', 1)
path.write_text(text, encoding='utf-8')
