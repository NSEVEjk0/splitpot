import { notFound } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { verify } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProofPage({
  params,
}: {
  params: { potId: string; participantId: string };
}) {
  const result = await verify(params.potId, params.participantId);
  if (!result) notFound();

  const verifyUrl = `/api/verify/${params.potId}/${params.participantId}`;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-neutral-500">
          Settlement story
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {result.name} · {result.potTitle}
        </h1>
      </section>

      <section
        className={`rounded-xl border p-6 ${
          result.paid
            ? "border-green-300 bg-green-50"
            : "border-neutral-200 bg-white"
        }`}
      >
        <p className="text-lg font-semibold">
          {result.paid ? "Paid and settled" : "Not paid yet"}
        </p>
        <p className="mt-2 text-neutral-700">
          {result.name} owes {result.amounts.share} {result.amounts.currencyNote} of a{" "}
          {result.amounts.total} {result.amounts.currencyNote} pot.
        </p>
        {result.paid ? (
          <p className="mt-2 text-neutral-700">
            {result.name} paid in the token and chain of their choice. Moove Agentic
            Payments converted and settled it to{" "}
            <a href={BRAND.mooveProfileUrl} className="font-medium underline">
              {result.handle}
            </a>
            {result.completedAt ? ` on ${result.completedAt}` : ""}.
          </p>
        ) : (
          <p className="mt-2 text-neutral-700">
            Once this Moove link is completed, this page becomes the receipt.
          </p>
        )}
      </section>

      <dl className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-white p-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-neutral-500">Share</dt>
          <dd className="font-medium">
            {result.amounts.share} {result.amounts.currencyNote}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Pot total</dt>
          <dd className="font-medium">
            {result.amounts.total} {result.amounts.currencyNote}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Settles to</dt>
          <dd className="font-medium">{result.handle}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Moove link id</dt>
          <dd className="break-all font-mono text-xs">
            {result.mooveLinkId ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Completed at</dt>
          <dd className="font-medium">{result.completedAt ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Status</dt>
          <dd className="font-medium">{result.paid ? "paid" : "unpaid"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-4 text-sm">
        <a href={verifyUrl} className="text-neutral-700 underline hover:text-neutral-900">
          Verify as JSON
        </a>
        <a
          href={`/pots/${params.potId}`}
          className="text-neutral-700 underline hover:text-neutral-900"
        >
          Back to the pot
        </a>
      </div>
    </div>
  );
}
