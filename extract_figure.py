"""Extract the original LURCH figure, without redrawing research results.

Requires pymupdf. Downloads the verified v1 paper. Run from any directory.
"""
from pathlib import Path
import argparse
import subprocess
import pymupdf

parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', type=Path, default=Path(__file__).parent)
destination = parser.parse_args().output_dir
destination.mkdir(parents=True, exist_ok=True)
download = subprocess.run(['curl', '-L', '--fail', '--silent', '--show-error',
    'https://arxiv.org/pdf/2610.22067v1'], check=True, capture_output=True)
original = pymupdf.open(stream=download.stdout, filetype="pdf")
crop = pymupdf.Rect(150, 480, 459, 690)
output = pymupdf.open()
page = output.new_page(width=crop.width, height=crop.height)
page.show_pdf_page(page.rect, original, 0, clip=crop)
(destination / "lurch-context.svg").write_text(page.get_svg_image(), encoding="utf-8")
