"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";

import type { ContactFormState } from "@/app/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { isFrequency } from "@/lib/keep-in-touch";
import { foldGroupName, groupNameSchema, type ContactField } from "@/lib/validation";

// Radio items cannot have an empty value, so "not set" is "none" here and empty in the submitted form
const FREQUENCY_OPTIONS = [
  { value: "none", label: "Не задано" },
  { value: "week", label: "Раз в неделю" },
  { value: "month", label: "Раз в месяц" },
  { value: "quarter", label: "Раз в квартал" },
  { value: "year", label: "Раз в год" },
] as const;

type ContactFormProps = {
  action: (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  defaultValues?: Partial<Record<ContactField, string | number | null>>;
  submitLabel: string;
  cancelHref: string;
  groups: { id: number; name: string }[];
  defaultGroupIds?: number[];
};

export function ContactForm({
  action,
  defaultValues,
  submitLabel,
  cancelHref,
  groups,
  defaultGroupIds = [],
}: ContactFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});
  const initialFrequency = defaultValues?.keepInTouchFrequency;
  const [frequency, setFrequency] = useState(
    isFrequency(initialFrequency) ? initialFrequency : "none",
  );

  // Group choices live here, not in the DOM, so they survive a form error. New names are only
  // created on the server when the contact is saved.
  const [checkedGroupIds, setCheckedGroupIds] = useState(new Set(defaultGroupIds));
  const [newGroups, setNewGroups] = useState<string[]>([]);
  const [newGroupText, setNewGroupText] = useState("");
  const [newGroupError, setNewGroupError] = useState<string>();

  function toggleGroup(id: number, checked: boolean) {
    setCheckedGroupIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function addNewGroup() {
    const parsed = groupNameSchema.safeParse(newGroupText);
    if (!parsed.success) {
      setNewGroupError(parsed.error.issues[0].message);
      return;
    }
    const folded = foldGroupName(parsed.data);
    const existing = groups.find((group) => foldGroupName(group.name) === folded);
    if (existing) {
      toggleGroup(existing.id, true);
    } else if (!newGroups.some((name) => foldGroupName(name) === folded)) {
      setNewGroups([...newGroups, parsed.data]);
    }
    setNewGroupText("");
    setNewGroupError(undefined);
  }

  // Submit manually so React does not clear the fields when the server returns errors.
  // `action` on the form still works if the page is submitted before JavaScript loads.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  function fieldProps(name: ContactField) {
    const error = state.fieldErrors?.[name];
    return {
      id: name,
      name,
      defaultValue: defaultValues?.[name] ?? "",
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${name}-error` : undefined,
    };
  }

  function errorFor(name: ContactField) {
    const error = state.fieldErrors?.[name];
    return error ? <FieldError id={`${name}-error`}>{error}</FieldError> : null;
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {state.formError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field data-invalid={Boolean(state.fieldErrors?.name)}>
          <FieldLabel htmlFor="name">Имя и фамилия *</FieldLabel>
          <Input {...fieldProps("name")} required autoFocus autoComplete="off" />
          {errorFor("name")}
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors?.about)}>
          <FieldLabel htmlFor="about">Кто это</FieldLabel>
          <Input
            {...fieldProps("about")}
            placeholder="Например: дизайнер в студии, сосед по даче"
            autoComplete="off"
          />
          {errorFor("about")}
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors?.howWeMet)}>
          <FieldLabel htmlFor="howWeMet">Откуда знакомы</FieldLabel>
          <Textarea
            {...fieldProps("howWeMet")}
            placeholder="Где и когда познакомились, через кого"
            rows={3}
          />
          {errorFor("howWeMet")}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(state.fieldErrors?.phone)}>
            <FieldLabel htmlFor="phone">Телефон</FieldLabel>
            <Input
              {...fieldProps("phone")}
              type="tel"
              inputMode="tel"
              placeholder="+7 900 123-45-67"
              autoComplete="off"
            />
            {errorFor("phone")}
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.email)}>
            <FieldLabel htmlFor="email">Почта</FieldLabel>
            <Input
              {...fieldProps("email")}
              type="email"
              placeholder="name@example.com"
              autoComplete="off"
            />
            {errorFor("email")}
          </Field>
        </div>

        <Field data-invalid={Boolean(state.fieldErrors?.keepInTouchDays)}>
          <FieldLabel id="keepInTouchFrequency-label">Как часто общаться</FieldLabel>
          <input
            type="hidden"
            name="keepInTouchFrequency"
            value={frequency === "none" ? "" : frequency}
          />
          <RadioGroup
            value={frequency}
            onValueChange={setFrequency}
            aria-labelledby="keepInTouchFrequency-label"
            className="gap-3"
          >
            {FREQUENCY_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center gap-3">
                <RadioGroupItem value={option.value} id={`frequency-${option.value}`} />
                <Label htmlFor={`frequency-${option.value}`} className="text-16 font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <RadioGroupItem value="days" id="frequency-days" />
              <Label htmlFor="frequency-days" className="text-16 font-normal">
                Свой срок
              </Label>
              <span className={frequency === "days" ? "flex items-center gap-2" : "hidden"}>
                <span className="text-16 text-ink-soft">Раз в</span>
                <Input
                  {...fieldProps("keepInTouchDays")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="Число дней"
                  className="w-20"
                />
                <span className="text-16 text-ink-soft">дней</span>
              </span>
            </div>
          </RadioGroup>
          {errorFor("keepInTouchDays")}
        </Field>

        <Field data-invalid={Boolean(newGroupError ?? state.groupsError)}>
          <FieldLabel id="groups-label">Группы</FieldLabel>
          {[...checkedGroupIds].map((id) => (
            <input key={id} type="hidden" name="groupIds" value={id} />
          ))}
          {newGroups.map((name) => (
            <input key={name} type="hidden" name="newGroups" value={name} />
          ))}
          {groups.length === 0 && newGroups.length === 0 ? (
            <p className="text-14 text-ink-muted">
              Групп пока нет. Впишите название, чтобы создать первую
            </p>
          ) : (
            <div role="group" aria-labelledby="groups-label" className="flex flex-col gap-3">
              {groups.map((group) => (
                <div key={group.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`group-${group.id}`}
                    checked={checkedGroupIds.has(group.id)}
                    onCheckedChange={(checked) => toggleGroup(group.id, checked === true)}
                  />
                  <Label htmlFor={`group-${group.id}`} className="text-16 font-normal">
                    {group.name}
                  </Label>
                </div>
              ))}
              {newGroups.map((name, index) => (
                <div key={name} className="flex items-center gap-3">
                  <Checkbox
                    id={`new-group-${index}`}
                    checked
                    onCheckedChange={() => setNewGroups(newGroups.filter((item) => item !== name))}
                  />
                  <Label htmlFor={`new-group-${index}`} className="text-16 font-normal">
                    {name} <span className="text-ink-faint">(новая)</span>
                  </Label>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <Input
              value={newGroupText}
              onChange={(event) => setNewGroupText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addNewGroup();
                }
              }}
              placeholder="Новая группа"
              aria-label="Новая группа"
              aria-invalid={newGroupError ? true : undefined}
              autoComplete="off"
            />
            <Button type="button" variant="outline" onClick={addNewGroup}>
              Добавить
            </Button>
          </div>
          {(newGroupError ?? state.groupsError) ? (
            <FieldError>{newGroupError ?? state.groupsError}</FieldError>
          ) : null}
        </Field>
      </FieldGroup>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          {isPending ? "Сохраняю…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="lg" asChild>
          <Link href={cancelHref}>Отмена</Link>
        </Button>
      </div>
    </form>
  );
}
