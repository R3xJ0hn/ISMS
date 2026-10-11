"use client";

import * as React from "react";
import { Download, FileCheck2, QrCode } from "lucide-react";
import type { AdmissionConfirmation } from "./wizard-state";

const REQUIRED_DOCUMENT_NOTE =
  "Bring a valid ID, report card or transcript, birth certificate, and latest 2x2 photo for manual review in the registrar office.";

function createQrModules(value: string) {
  const size = 21;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  function set(row: number, column: number, dark: boolean, reserve = true) {
    if (row < 0 || row >= size || column < 0 || column >= size) {
      return;
    }

    modules[row][column] = dark;
    if (reserve) {
      reserved[row][column] = true;
    }
  }

  function finder(row: number, column: number) {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const inCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(row + r, column + c, inOuter && (r === 0 || r === 6 || c === 0 || c === 6 || inCenter));
      }
    }
  }

  finder(0, 0);
  finder(0, 14);
  finder(14, 0);

  for (let index = 8; index < 13; index += 1) {
    set(6, index, index % 2 === 0);
    set(index, 6, index % 2 === 0);
  }

  set(13, 8, true);

  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      reserved[8][index] = true;
      reserved[index][8] = true;
    }
  }

  for (let index = 0; index < 8; index += 1) {
    reserved[8][size - 1 - index] = true;
    reserved[size - 1 - index][8] = true;
  }

  const bits: number[] = [];
  const pushBits = (number: number, length: number) => {
    for (let index = length - 1; index >= 0; index -= 1) {
      bits.push((number >>> index) & 1);
    }
  };
  const digits = value.replace(/\D/g, "").slice(0, 8).padStart(8, "0");

  pushBits(0b0001, 4);
  pushBits(digits.length, 10);
  for (let index = 0; index < digits.length; index += 3) {
    const group = digits.slice(index, index + 3);
    pushBits(Number(group), group.length === 3 ? 10 : group.length === 2 ? 7 : 4);
  }
  pushBits(0, Math.min(4, 152 - bits.length));
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataCodewords: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    dataCodewords.push(Number.parseInt(bits.slice(index, index + 8).join(""), 2));
  }
  for (let index = 0; dataCodewords.length < 19; index += 1) {
    dataCodewords.push(index % 2 === 0 ? 0xec : 0x11);
  }

  const codewords = [...dataCodewords, ...createErrorCorrection(dataCodewords, 7)];
  const dataBits = codewords.flatMap((codeword) =>
    Array.from({ length: 8 }, (_, index) => (codeword >>> (7 - index)) & 1)
  );

  let bitIndex = 0;
  let direction = -1;

  for (let column = size - 1; column > 0; column -= 2) {
    if (column === 6) {
      column -= 1;
    }

    for (
      let row = direction === -1 ? size - 1 : 0;
      row >= 0 && row < size;
      row += direction
    ) {
      for (let offset = 0; offset < 2; offset += 1) {
        const currentColumn = column - offset;

        if (reserved[row][currentColumn]) {
          continue;
        }

        const maskedBit = (dataBits[bitIndex] ?? 0) === 1;
        modules[row][currentColumn] =
          (row + currentColumn) % 2 === 0 ? !maskedBit : maskedBit;
        bitIndex += 1;
      }
    }

    direction *= -1;
  }

  const formatBits = getFormatBits(0b01, 0);

  for (let index = 0; index <= 5; index += 1) {
    set(8, index, ((formatBits >> index) & 1) === 1);
  }
  set(8, 7, ((formatBits >> 6) & 1) === 1);
  set(8, 8, ((formatBits >> 7) & 1) === 1);
  set(7, 8, ((formatBits >> 8) & 1) === 1);
  for (let index = 9; index < 15; index += 1) {
    set(14 - index, 8, ((formatBits >> index) & 1) === 1);
  }
  for (let index = 0; index < 8; index += 1) {
    set(size - 1 - index, 8, ((formatBits >> index) & 1) === 1);
  }
  for (let index = 8; index < 15; index += 1) {
    set(8, size - 15 + index, ((formatBits >> index) & 1) === 1);
  }

  return modules;
}

function createErrorCorrection(data: number[], ecCodewords: number) {
  const generator = createGeneratorPolynomial(ecCodewords);
  const message = [...data, ...Array(ecCodewords).fill(0)];

  for (let index = 0; index < data.length; index += 1) {
    const coefficient = message[index];

    if (coefficient === 0) {
      continue;
    }

    for (let ecIndex = 0; ecIndex < generator.length; ecIndex += 1) {
      message[index + ecIndex] ^= gfMultiply(generator[ecIndex], coefficient);
    }
  }

  return message.slice(data.length);
}

function createGeneratorPolynomial(degree: number) {
  let generator = [1];

  for (let index = 0; index < degree; index += 1) {
    const next = Array(generator.length + 1).fill(0);

    generator.forEach((coefficient, coefficientIndex) => {
      next[coefficientIndex] ^= coefficient;
      next[coefficientIndex + 1] ^= gfMultiply(coefficient, gfPow(2, index));
    });
    generator = next;
  }

  return generator;
}

function gfPow(value: number, power: number) {
  let result = 1;

  for (let index = 0; index < power; index += 1) {
    result = gfMultiply(result, value);
  }

  return result;
}

function gfMultiply(left: number, right: number) {
  let product = 0;
  let multiplicand = left;
  let multiplier = right;

  while (multiplier > 0) {
    if (multiplier & 1) {
      product ^= multiplicand;
    }

    multiplicand <<= 1;
    if (multiplicand & 0x100) {
      multiplicand ^= 0x11d;
    }
    multiplier >>= 1;
  }

  return product;
}

function getFormatBits(errorCorrectionLevel: number, maskPattern: number) {
  const data = (errorCorrectionLevel << 3) | maskPattern;
  let bits = data << 10;

  for (let index = 14; index >= 10; index -= 1) {
    if ((bits >> index) & 1) {
      bits ^= 0x537 << (index - 10);
    }
  }

  return ((data << 10) | bits) ^ 0x5412;
}

function drawAdmissionSlip(
  canvas: HTMLCanvasElement,
  confirmation: AdmissionConfirmation
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const width = 900;
  const height = 1180;
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#111827";
  context.font = "700 34px Arial";
  context.fillText("Admission Manual Review Slip", 60, 80);
  context.font = "400 20px Arial";
  context.fillStyle = "#4b5563";
  context.fillText("Present this slip at the registrar office for document checking.", 60, 118);
  context.fillStyle = "#f3f4f6";
  context.fillRect(60, 155, 780, 130);
  context.fillStyle = "#111827";
  context.font = "700 20px Arial";
  context.fillText("Submission reference", 90, 205);
  context.font = "700 54px Arial";
  context.fillText(confirmation.submissionId, 90, 260);
  context.font = "400 18px Arial";
  context.fillStyle = "#4b5563";
  context.fillText(`Submitted: ${new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(confirmation.submittedAt))}`, 470, 245);

  drawQr(context, confirmation.submissionId, 290, 340, 320);

  context.fillStyle = "#111827";
  context.font = "700 24px Arial";
  context.fillText("Bring these requirements", 60, 740);
  context.font = "400 22px Arial";
  const requirements = [
    "Valid ID",
    "Report card or transcript",
    "Birth certificate",
    "Latest 2x2 photo",
  ];
  requirements.forEach((requirement, index) => {
    context.fillText(`${index + 1}. ${requirement}`, 90, 790 + index * 42);
  });
  context.fillStyle = "#374151";
  context.font = "400 20px Arial";
  wrapCanvasText(context, REQUIRED_DOCUMENT_NOTE, 60, 1000, 760, 30);
}

function drawQr(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number
) {
  const modules = createQrModules(value);
  const quiet = 4;
  const cell = size / (modules.length + quiet * 2);

  context.fillStyle = "#ffffff";
  context.fillRect(x, y, size, size);
  context.fillStyle = "#111827";
  modules.forEach((row, rowIndex) => {
    row.forEach((dark, columnIndex) => {
      if (dark) {
        context.fillRect(
          x + (columnIndex + quiet) * cell,
          y + (rowIndex + quiet) * cell,
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    });
  });
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;

    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  });

  if (line) {
    context.fillText(line, x, currentY);
  }
}

export default function AdmissionConfirmationView({
  confirmation,
}: {
  confirmation: AdmissionConfirmation;
}) {
  const qrCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const slipCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const qrCanvas = qrCanvasRef.current;
    const slipCanvas = slipCanvasRef.current;

    if (qrCanvas) {
      qrCanvas.width = 220;
      qrCanvas.height = 220;
      const context = qrCanvas.getContext("2d");

      if (context) {
        drawQr(context, confirmation.submissionId, 0, 0, 220);
      }
    }

    if (slipCanvas) {
      drawAdmissionSlip(slipCanvas, confirmation);
    }
  }, [confirmation]);

  function downloadSlip() {
    const canvas = slipCanvasRef.current;

    if (!canvas) {
      return;
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `admission-${confirmation.submissionId}.png`;
    link.click();
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl items-center">
      <div className="w-full rounded-lg border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="grid size-11 shrink-0 place-items-center rounded-md bg-emerald-600 text-white">
            <FileCheck2 size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Submission received
            </p>
            <h3 className="mt-1 text-2xl font-bold text-gray-950">
              Proceed to registrar manual review.
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-700">
              Your online admission form was received. Download or save the
              reference slip, then bring the listed documents to the registrar
              office for checking and next-step processing.
            </p>

            <dl className="mt-5 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-gray-600">
                  Submission reference
                </dt>
                <dd className="mt-1 font-mono text-3xl font-bold tracking-wider text-gray-950">
                  {confirmation.submissionId}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-600">Submitted at</dt>
                <dd className="mt-1 text-gray-950">
                  {new Intl.DateTimeFormat("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(confirmation.submittedAt))}
                </dd>
              </div>
            </dl>

            <div className="mt-5 rounded-lg border border-secondary/25 bg-secondary/5 p-4">
              <p className="text-sm font-semibold text-gray-950">
                Registrar office requirements
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                {REQUIRED_DOCUMENT_NOTE}
              </p>
            </div>
          </div>

          <div className="w-full shrink-0 rounded-lg border border-gray-200 bg-white p-4 text-center lg:w-64">
            <div className="mx-auto grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
              <QrCode size={18} aria-hidden="true" />
            </div>
            <canvas
              ref={qrCanvasRef}
              className="mx-auto mt-3 size-44"
              aria-label={`QR code for submission reference ${confirmation.submissionId}`}
            />
            <button
              type="button"
              onClick={downloadSlip}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              <Download size={16} aria-hidden="true" />
              Download PNG
            </button>
            <canvas ref={slipCanvasRef} className="hidden" />
          </div>
        </div>
      </div>
    </div>
  );
}

