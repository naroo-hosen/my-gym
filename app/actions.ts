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
  const rawName = formData.get("name");
  const rawPhone = formData.get("phone");
  const rawBirthDate = formData.get("birthDate");
  const rawGender = formData.get("gender");
  const rawParentPhone = formData.get("parentPhone");
  const rawMemo = formData.get("memo");

  if (!id) {
    return;
  }

  const data: {
    name?: string;
    phone?: string;
    birthDate?: Date | null;
    gender?: string | null;
    parentPhone?: string | null;
    memo?: string | null;
  } = {};

  if (rawName !== null) {
    const name = rawName.toString().trim();
    if (!name) {
      return;
    }
    data.name = name;
  }

  if (rawPhone !== null) {
    const phone = rawPhone.toString().trim();
    if (!phone) {
      return;
    }
    data.phone = phone;
  }

  if (rawBirthDate !== null) {
    const birthDateValue = rawBirthDate.toString().trim();
    data.birthDate = birthDateValue ? new Date(birthDateValue) : null;
  }

  if (rawGender !== null) {
    const genderValue = rawGender.toString().trim();
    data.gender = genderValue ? genderValue : null;
  }

  if (rawParentPhone !== null) {
    const parentPhoneValue = rawParentPhone.toString().trim();
    data.parentPhone = parentPhoneValue ? parentPhoneValue : null;
  }

  if (rawMemo !== null) {
    const memoValue = rawMemo.toString().trim();
    data.memo = memoValue ? memoValue : null;
  }

  if (Object.keys(data).length === 0) {
    return;
  }

  await prisma.member.update({
    where: { id },
    data,
  });

  revalidatePath("/");
};

export const deleteMember = async (formData: FormData) => {
  const id = Number(formData.get("id"));

  if (!id) {
    return;
  }

  await prisma.member.update({
    where: { id },
    data: {
      status: "DELETE",
    },
  });

  revalidatePath("/");
};

export const createMembership = async (formData: FormData) => {
  const duration = Number(formData.get("duration"));
  const weeklyAttendance = Number(formData.get("weeklyAttendance"));
  const price = Number(formData.get("price"));

  if (
    !Number.isInteger(duration) ||
    duration <= 0 ||
    Number.isNaN(weeklyAttendance) ||
    Number.isNaN(price)
  ) {
    return;
  }

  await prisma.membership.create({
    data: {
      duration,
      weeklyAttendance,
      price,
    },
  });

  revalidatePath("/");
};

export const deleteMembership = async (formData: FormData) => {
  const id = Number(formData.get("id"));

  if (!id) {
    return;
  }

  await prisma.membership.update({
    where: { id },
    data: {
      status: "DELETE",
    },
  });

  revalidatePath("/");
};
