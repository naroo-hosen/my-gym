"use client";

import { useMemo, useState } from "react";
import { createMember, updateMember } from "@/app/actions";

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

type MemberFormProps = {
  mode: "create" | "update";
  member?: {
    id: number;
    name: string;
    phone: string;
  };
};

const MemberForm = ({ mode, member }: MemberFormProps) => {
  const [phone, setPhone] = useState(() => (member ? formatPhone(member.phone) : ""));

  const action = useMemo(() => (mode === "create" ? createMember : updateMember), [mode]);

  const title = mode === "create" ? "신규 회원 등록" : "회원 정보 수정";
  const buttonLabel = mode === "create" ? "등록하기" : "수정 저장";

  return (
    <form action={action} className="member-form">
      {member ? <input type="hidden" name="id" value={member.id} /> : null}
      <div className="form-header">
        <div>
          <h3>{title}</h3>
          <p>이름과 전화번호를 입력해 주세요.</p>
        </div>
        <button className="button-primary" type="submit">
          {buttonLabel}
        </button>
      </div>
      <div className="grid two-column">
        <div>
          <label htmlFor={`${mode}-name-${member?.id ?? "new"}`}>이름</label>
          <input
            id={`${mode}-name-${member?.id ?? "new"}`}
            name="name"
            placeholder="홍길동"
            defaultValue={member?.name ?? ""}
            required
          />
        </div>
        <div>
          <label htmlFor={`${mode}-phone-${member?.id ?? "new"}`}>전화번호</label>
          <input
            id={`${mode}-phone-${member?.id ?? "new"}`}
            name="phone"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(event) => setPhone(formatPhone(event.target.value))}
            required
          />
        </div>
      </div>
      <span className="helper-text">숫자만 입력해도 자동으로 하이픈이 추가돼요.</span>
    </form>
  );
};

export default MemberForm;
