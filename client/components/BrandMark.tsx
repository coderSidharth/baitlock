import { Shield } from "lucide-react";

export default function BrandMark() {
  return (
    <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
      <Shield size={16} className="text-primary-foreground" strokeWidth={2.2} />
    </span>
  );
}
