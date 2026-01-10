"use client";

import { useEffect, useState } from "react";

type PhoneInputProps = {
  id: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
};

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

const PhoneInput = ({
  id,
  name,
  defaultValue = "",
  placeholder,
  required,
}: PhoneInputProps) => {
  const [value, setValue] = useState(() => formatPhone(defaultValue ?? ""));

  useEffect(() => {
    setValue(formatPhone(defaultValue ?? ""));
  }, [defaultValue]);

  return (
    <input
      id={id}
      name={name}
      value={value}
      onChange={(event) => setValue(formatPhone(event.target.value))}
      placeholder={placeholder}
      required={required}
      inputMode="numeric"
    />
  );
};

export default PhoneInput;
