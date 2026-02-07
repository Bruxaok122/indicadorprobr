import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone } from "lucide-react";
import { WabaPhoneNumber } from "@/hooks/useWabaPhones";
import { cn } from "@/lib/utils";

interface PhoneNumberSelectorProps {
  phones: WabaPhoneNumber[];
  selectedPhoneNumberId: string;
  onSelect: (phoneNumberId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function PhoneNumberSelector({
  phones,
  selectedPhoneNumberId,
  onSelect,
  disabled,
  className,
}: PhoneNumberSelectorProps) {
  if (phones.length === 0) return null;

  return (
    <Select value={selectedPhoneNumberId} onValueChange={onSelect} disabled={disabled}>
      <SelectTrigger className={cn("w-full", className)}>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Selecione o número de disparo" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {phones.map((phone) => (
          <SelectItem key={phone.id} value={phone.phone_number_id}>
            {phone.display_phone_number}
            {phone.verified_name && (
              <span className="ml-1 text-muted-foreground">({phone.verified_name})</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
