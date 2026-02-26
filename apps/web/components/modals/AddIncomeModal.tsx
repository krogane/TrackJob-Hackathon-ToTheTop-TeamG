'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { INCOME_CATEGORIES } from '@lifebalance/shared/types'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCreateTransaction } from '@/hooks/useTransactions'
import { useToast } from '@/hooks/useToast'

const formSchema = z.object({
  amount: z.number({ invalid_type_error: '金額を入力してください' }).min(1, '1円以上を入力してください'),
  category: z.enum(INCOME_CATEGORIES, {
    required_error: 'カテゴリを選択してください',
  }),
  description: z.string().max(200, 'タイトルは200文字以内で入力してください').optional().default(''),
  transactedAt: z.string().min(1, '日付を選択してください'),
})

type FormValues = z.infer<typeof formSchema>

interface AddIncomeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatAmountInput(value: string) {
  const digitsOnly = value.replace(/\D/g, '')
  if (!digitsOnly) {
    return ''
  }
  return Number(digitsOnly).toLocaleString('ja-JP')
}

export function AddIncomeModal({ open, onOpenChange }: AddIncomeModalProps) {
  const [amountInput, setAmountInput] = useState('')
  const createTransaction = useCreateTransaction()
  const { toast } = useToast()

  const categories = [
    { value: 'salary', label: '給与', icon: '💼' },
    { value: 'bonus', label: '賞与', icon: '🎁' },
    { value: 'side_income', label: '副収入', icon: '💡' },
    { value: 'other', label: 'その他', icon: '📦' },
  ] as const

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: undefined,
      category: 'salary',
      description: '',
      transactedAt: new Date().toISOString().slice(0, 10),
    },
  })

  const onSubmit = async (values: FormValues) => {
    await createTransaction.mutateAsync({
      amount: values.amount,
      type: 'income',
      category: values.category,
      description: values.description,
      transacted_at: values.transactedAt,
    })

    toast({ title: '収入を追加しました。', variant: 'success' })
    setAmountInput('')
    reset({
      amount: undefined,
      category: 'salary',
      description: '',
      transactedAt: new Date().toISOString().slice(0, 10),
    })
    onOpenChange(false)
  }

  useEffect(() => {
    if (open) return
    setAmountInput('')
    reset({
      amount: undefined,
      category: 'salary',
      description: '',
      transactedAt: new Date().toISOString().slice(0, 10),
    })
  }, [open, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] bg-card">
        <DialogHeader>
          <DialogTitle>収入を追加</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[58vh] py-3">
          <form id="add-income-form" className="space-y-2.5" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1">
              <label className="text-xs text-text2" htmlFor="income-description">
                タイトル（任意）
              </label>
              <Input id="income-description" {...register('description')} />
              {errors.description ? <p className="text-xs text-danger">{errors.description.message}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text2" htmlFor="income-amount">
                金額
              </label>
              <input type="hidden" {...register('amount', { valueAsNumber: true })} />
              <Input
                id="income-amount"
                type="text"
                inputMode="numeric"
                placeholder="例: 250,000"
                value={amountInput}
                onChange={(event) => {
                  const formatted = formatAmountInput(event.target.value)
                  setAmountInput(formatted)
                  const rawNumber = formatted.replace(/,/g, '')
                  setValue('amount', rawNumber ? Number(rawNumber) : 0, { shouldValidate: true })
                }}
              />
              {errors.amount ? <p className="text-xs text-danger">{errors.amount.message}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text2">カテゴリ</label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((category) => {
                      const isSelected = field.value === category.value
                      return (
                        <button
                          key={category.value}
                          type="button"
                          className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                            isSelected
                              ? 'border-accent bg-accent/15 text-accent shadow-[0_6px_12px_rgba(31,143,105,0.2)]'
                              : 'border-border bg-card2 text-text2 hover:border-accent/40 hover:text-text'
                          }`}
                          onClick={() => {
                            field.onChange(category.value)
                          }}
                          aria-label={category.label}
                          aria-pressed={isSelected}
                        >
                          <span className="block text-base">{category.icon}</span>
                          {category.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              />
              {errors.category ? <p className="text-xs text-danger">{errors.category.message}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text2" htmlFor="income-transactedAt">
                日付
              </label>
              <Input id="income-transactedAt" type="date" {...register('transactedAt')} />
              {errors.transactedAt ? <p className="text-xs text-danger">{errors.transactedAt.message}</p> : null}
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={createTransaction.isPending}>
            キャンセル
          </Button>
          <Button
            className="bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)]"
            form="add-income-form"
            type="submit"
            disabled={createTransaction.isPending}
          >
            {createTransaction.isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
