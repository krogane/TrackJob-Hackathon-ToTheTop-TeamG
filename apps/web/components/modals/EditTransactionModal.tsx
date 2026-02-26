'use client'

import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { INCOME_CATEGORIES, type Transaction, type TransactionCategory } from '@lifebalance/shared/types'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useDeleteTransaction, usePatchTransaction } from '@/hooks/useTransactions'

const categoryValues = [
  'housing',
  'food',
  'transport',
  'entertainment',
  'clothing',
  'communication',
  'medical',
  'social',
  'other',
  'salary',
  'bonus',
  'side_income',
] as const satisfies readonly [TransactionCategory, ...TransactionCategory[]]

const formSchema = z.object({
  amount: z.number({ invalid_type_error: '金額を入力してください' }).int().min(1, '1円以上を入力してください'),
  category: z.enum(categoryValues),
  description: z.string().max(200, 'タイトルは200文字以内で入力してください').optional().default(''),
  transactedAt: z.string().min(1, '日付を選択してください'),
})

type FormValues = z.infer<typeof formSchema>

interface EditTransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
}

function formatAmountInput(value: string) {
  const digitsOnly = value.replace(/\D/g, '')
  if (!digitsOnly) {
    return ''
  }
  return Number(digitsOnly).toLocaleString('ja-JP')
}

function resolveType(
  category: TransactionCategory,
  previousType: 'expense' | 'income',
): 'expense' | 'income' {
  if (category === 'other') {
    return previousType
  }
  return INCOME_CATEGORIES.includes(category as (typeof INCOME_CATEGORIES)[number]) ? 'income' : 'expense'
}

export function EditTransactionModal({ open, onOpenChange, transaction }: EditTransactionModalProps) {
  const patchTransaction = usePatchTransaction()
  const deleteTransaction = useDeleteTransaction()
  const [amountInput, setAmountInput] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  })

  useEffect(() => {
    if (!transaction) {
      setAmountInput('')
      return
    }

    const normalizedAmount = Number(transaction.amount) || 0
    reset({
      amount: normalizedAmount,
      category: transaction.category,
      description: transaction.description ?? '',
      transactedAt: transaction.transacted_at,
    })
    setAmountInput(normalizedAmount.toLocaleString('ja-JP'))
  }, [transaction, reset])

  const isPending = patchTransaction.isPending || deleteTransaction.isPending

  const incomeOptions = useMemo(
    () => [
      { value: 'salary', label: '給与' },
      { value: 'bonus', label: '賞与' },
      { value: 'side_income', label: '副収入' },
    ],
    [],
  )
  const expenseOptions = useMemo(
    () => [
      { value: 'housing', label: '住居費' },
      { value: 'food', label: '食費' },
      { value: 'transport', label: '交通費' },
      { value: 'entertainment', label: '娯楽' },
      { value: 'clothing', label: '衣類' },
      { value: 'communication', label: '通信' },
      { value: 'medical', label: '医療' },
      { value: 'social', label: '交際費' },
      { value: 'other', label: 'その他' },
    ],
    [],
  )

  const onSubmit = async (values: FormValues) => {
    if (!transaction) return

    await patchTransaction.mutateAsync({
      id: transaction.id,
      body: {
        amount: values.amount,
        category: values.category,
        type: resolveType(values.category, transaction.type),
        description: values.description,
        transacted_at: values.transactedAt,
      },
    })
    onOpenChange(false)
  }

  const onDelete = async () => {
    if (!transaction) return
    const confirmed = window.confirm('この履歴を削除しますか？')
    if (!confirmed) return

    await deleteTransaction.mutateAsync(transaction.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] bg-card">
        <DialogHeader>
          <DialogTitle>履歴を編集</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[58vh] py-3">
          <form id="edit-transaction-form" className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1">
              <label className="text-xs text-text2" htmlFor="edit-description">
                タイトル（任意）
              </label>
              <Input id="edit-description" {...register('description')} />
              {errors.description ? <p className="text-xs text-danger">{errors.description.message}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text2" htmlFor="edit-amount">
                金額
              </label>
              <input type="hidden" {...register('amount', { valueAsNumber: true })} />
              <Input
                id="edit-amount"
                type="text"
                inputMode="numeric"
                placeholder="例: 12,000"
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
              <label className="text-xs text-text2" htmlFor="edit-category">
                カテゴリ
              </label>
              <Select id="edit-category" {...register('category')}>
                <optgroup label="支出カテゴリ">
                  {expenseOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="収入カテゴリ">
                  {incomeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              </Select>
              {errors.category ? <p className="text-xs text-danger">{errors.category.message}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text2" htmlFor="edit-transacted-at">
                日付
              </label>
              <Input id="edit-transacted-at" type="date" {...register('transactedAt')} />
              {errors.transactedAt ? <p className="text-xs text-danger">{errors.transactedAt.message}</p> : null}
            </div>
          </form>
        </DialogBody>
        <DialogFooter className="w-full items-center">
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onDelete()}
            disabled={isPending || !transaction}
          >
            削除
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              キャンセル
            </Button>
            <Button
              className="bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)]"
              form="edit-transaction-form"
              type="submit"
              disabled={isPending || !transaction}
            >
              {patchTransaction.isPending ? '保存中...' : '編集を保存'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
