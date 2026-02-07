import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type SalesEntryResponse = {
  id: number;
  type: "income" | "expense";
  date: string;
  amount: number;
  title: string;
  description: string;
};

type SalesEntryRequest = {
  type?: "income" | "expense";
  date?: string;
  amount?: number;
  title?: string;
  description?: string;
};

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const GET = async () => {
  const entries = await prisma.salesEntry.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const payload: SalesEntryResponse[] = entries.map((entry) => ({
    id: entry.id,
    type: entry.type === "expense" ? "expense" : "income",
    date: toDateOnly(entry.date),
    amount: entry.amount,
    title: entry.title,
    description: entry.description,
  }));

  return NextResponse.json(payload);
};

export const POST = async (request: Request) => {
  let body: SalesEntryRequest | null = null;

  try {
    body = (await request.json()) as SalesEntryRequest;
  } catch (error) {
    return NextResponse.json({ message: "invalid_json" }, { status: 400 });
  }

  const type = body?.type;
  const rawDate = body?.date?.toString();
  const amount = Number(body?.amount);
  const title = body?.title?.toString().trim();
  const description = body?.description?.toString().trim() ?? "";

  if (!type || (type !== "income" && type !== "expense")) {
    return NextResponse.json({ message: "invalid_type" }, { status: 400 });
  }
  if (!rawDate) {
    return NextResponse.json({ message: "invalid_date" }, { status: 400 });
  }
  const parsedDate = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ message: "invalid_date" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ message: "invalid_amount" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ message: "invalid_title" }, { status: 400 });
  }

  const entry = await prisma.salesEntry.create({
    data: {
      type,
      date: parsedDate,
      amount: Math.round(Math.abs(amount)),
      title,
      description,
    },
  });

  const payload: SalesEntryResponse = {
    id: entry.id,
    type: entry.type === "expense" ? "expense" : "income",
    date: toDateOnly(entry.date),
    amount: entry.amount,
    title: entry.title,
    description: entry.description,
  };

  return NextResponse.json(payload, { status: 201 });
};

export const DELETE = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");
  const id = Number(idParam);

  if (!idParam || Number.isNaN(id)) {
    return NextResponse.json({ message: "invalid_id" }, { status: 400 });
  }

  const existing = await prisma.salesEntry.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "not_found" }, { status: 404 });
  }

  await prisma.salesEntry.delete({ where: { id } });

  return NextResponse.json({ status: "deleted" });
};
