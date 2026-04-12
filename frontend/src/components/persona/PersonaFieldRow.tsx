'use client'

import type { Control, FieldValues, Path } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrayInput } from './ArrayInput'
import type { PersonaFieldDef } from '@/lib/constants/personaFields'

interface PersonaFieldRowProps<T extends FieldValues> {
  field: PersonaFieldDef
  control: Control<T>
  isPublicField?: boolean
  onTogglePublic?: (fieldKey: string) => void
  showPublicToggle?: boolean
}

export function PersonaFieldRow<T extends FieldValues>({
  field,
  control,
  isPublicField,
  onTogglePublic,
  showPublicToggle,
}: PersonaFieldRowProps<T>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={field.key as string}>{field.label}</Label>
        {showPublicToggle && onTogglePublic && (
          <button
            type="button"
            onClick={() => onTogglePublic(field.key as string)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              isPublicField
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {isPublicField ? '공개' : '비공개'}
          </button>
        )}
      </div>

      <Controller
        name={field.key as unknown as Path<T>}
        control={control}
        render={({ field: rhfField }) => {
          switch (field.type) {
            case 'text':
              return (
                <Input
                  id={field.key as string}
                  value={(rhfField.value as string | null) ?? ''}
                  onChange={(e) => rhfField.onChange(e.target.value || null)}
                  placeholder={field.placeholder}
                />
              )
            case 'number':
              return (
                <Input
                  id={field.key as string}
                  type="number"
                  value={(rhfField.value as number | null) ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    rhfField.onChange(v === '' ? null : Number(v))
                  }}
                  placeholder={field.placeholder}
                />
              )
            case 'textarea':
              return (
                <Textarea
                  id={field.key as string}
                  value={(rhfField.value as string | null) ?? ''}
                  onChange={(e) => rhfField.onChange(e.target.value || null)}
                  placeholder={field.placeholder}
                  rows={3}
                />
              )
            case 'select':
              return (
                <Select
                  value={(rhfField.value as string | null) ?? ''}
                  onValueChange={(v) => rhfField.onChange(v || null)}
                >
                  <SelectTrigger id={field.key as string}>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            case 'array':
              return (
                <ArrayInput
                  value={(rhfField.value as string[] | null) ?? null}
                  onChange={rhfField.onChange}
                  placeholder={field.placeholder}
                />
              )
          }
        }}
      />

      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  )
}
