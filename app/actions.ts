"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const createMember = async (formData: FormData) => {
  const name = formData.get("name")?.toString().trim();
  const phone = formData.get("phone")?.toString().trim();
  const birthDateValue = formData.get("birthDate")?.toString().trim();
  const gender = formData.get("gender")?.toString().trim();
  const parentPhone = formData.get("parentPhone")?.toString().trim();
  const memo = formData.get("memo")?.toString().trim();

  if (!name || !phone) {
    return;
  }

  await prisma.member.create({
    data: {
      name,
      phone,
      birthDate: birthDateValue ? new Date(birthDateValue) : null,
      gender: gender || null,
      parentPhone: parentPhone || null,
      memo: memo || null,
    },
  });

  revalidatePath("/");
};

export const updateMember = async (formData: FormData) => {
  const id = Number(formData.get("id"));
  const name = formData.get("name")?.toString().trim();
  const phone = formData.get("phone")?.toString().trim();

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
};
