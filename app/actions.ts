"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export const createMember = async (formData: FormData) => {
  const name = formData.get("name")?.toString().trim();
  const phoneInput = formData.get("phone")?.toString().trim();
  const phone = phoneInput ? formatPhone(phoneInput) : undefined;

  if (!name || !phone) {
    return;
  }

  await prisma.member.create({
    data: {
      name,
      phone,
    },
  });

  revalidatePath("/");
  revalidatePath("/members");
};

export const updateMember = async (formData: FormData) => {
  const id = Number(formData.get("id"));
  const name = formData.get("name")?.toString().trim();
  const phoneInput = formData.get("phone")?.toString().trim();
  const phone = phoneInput ? formatPhone(phoneInput) : undefined;

  if (!id || !name || !phone) {
    return;
  }

  await prisma.member.update({
    where: { id },
    data: {
      name,
      phone,
    },
  });

  revalidatePath("/");
  revalidatePath("/members");
};

export const deleteMember = async (formData: FormData) => {
  const id = Number(formData.get("id"));

  if (!id) {
    return;
  }

  await prisma.member.delete({
    where: { id },
  });

  revalidatePath("/");
  revalidatePath("/members");
};
