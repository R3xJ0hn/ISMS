"use client";

import * as React from "react";
import { Download, FileCheck2, QrCode } from "lucide-react";
import { drawQr, wrapCanvasText } from "@/lib/qr-code";
import type { AdmissionConfirmation } from "./wizard-state";

const REQUIRED_DOCUMENT_NOTE =
  "Bring a valid ID, report card or transcript, birth certificate, and latest 2x2 photo for manual review in the registrar office.";

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
    <div className="mx-auto flex h-full min-w-0 max-w-4xl items-center">
      <div className="min-w-0 w-full rounded-lg border border-emerald-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start">
          <div className="grid size-11 shrink-0 place-items-center rounded-md bg-emerald-600 text-white">
            <FileCheck2 size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 sm:text-sm sm:tracking-[0.18em]">
              Submission received
            </p>
            <h3 className="mt-1 text-xl font-bold text-gray-950 sm:text-2xl">
              Proceed to registrar manual review.
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-700">
              Your online admission form was received. Download or save the
              reference slip, then bring the listed documents to the registrar
              office for checking and next-step processing.
            </p>

            <dl className="mt-4 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm sm:mt-5 sm:grid-cols-2 sm:p-4">
              <div className="min-w-0">
                <dt className="font-semibold text-gray-600">
                  Submission reference
                </dt>
                <dd className="mt-1 font-mono text-2xl font-bold tracking-wider text-gray-950 [overflow-wrap:anywhere] sm:text-3xl">
                  {confirmation.submissionId}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-semibold text-gray-600">Submitted at</dt>
                <dd className="mt-1 leading-6 text-gray-950">
                  {new Intl.DateTimeFormat("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(confirmation.submittedAt))}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-lg border border-secondary/25 bg-secondary/5 p-3 sm:mt-5 sm:p-4">
              <p className="text-sm font-semibold text-gray-950">
                Registrar office requirements
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                {REQUIRED_DOCUMENT_NOTE}
              </p>
            </div>
          </div>

          <div className="mx-auto w-full min-w-0 max-w-xs shrink-0 rounded-lg border border-gray-200 bg-white p-3 text-center sm:p-4 lg:w-64">
            <div className="mx-auto grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
              <QrCode size={18} aria-hidden="true" />
            </div>
            <canvas
              ref={qrCanvasRef}
              className="mx-auto mt-3 h-auto w-44 max-w-full"
              aria-label={`QR code for submission reference ${confirmation.submissionId}`}
            />
            <button
              type="button"
              onClick={downloadSlip}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-11 sm:px-4"
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

