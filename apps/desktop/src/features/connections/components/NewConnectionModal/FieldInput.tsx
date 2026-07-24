import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import clsx from "clsx";

interface FieldInputProps {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus,
  className,
}: FieldInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <label className="text-[10px] uppercase font-semibold tracking-wider text-muted">
        {label}
      </label>
      <div className="relative group">
        <input
          type={isPassword ? (showPassword ? "text" : "password") : type}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          className={clsx(
            "w-full px-3 py-2 bg-base border border-strong rounded-md text-sm text-primary placeholder:text-muted placeholder:italic focus:border-blue-500 focus:outline-none transition-colors",
            isPassword && "pr-10",
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-primary transition-colors focus:outline-none"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
