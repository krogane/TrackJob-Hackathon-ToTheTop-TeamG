'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { Goal } from '@lifebalance/shared/types'

import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { usePatchGoal } from '@/hooks/useGoals'

const formSchema = z.object({
  title: z.string().min(1, 'タイトルを入力してください').max(50, 'タイトルは50文字以内で入力してください'),
  icon: z.string().min(1, 'アイコンを入力してください').max(2, 'アイコンは1文字で入力してください'),
  targetAmount: z.number({ invalid_type_error: '目標金額を入力してください' }).min(1, '1円以上を入力してください'),
  savedAmount: z.number({ invalid_type_error: '現在貯蓄額を入力してください' }).min(0, '0円以上を入力してください'),
  monthlySaving: z.number({ invalid_type_error: '月次積立を入力してください' }).min(0, '0円以上を入力してください'),
  targetYear: z.number({ invalid_type_error: '目標年を入力してください' }).min(new Date().getFullYear(), '今年以降を入力してください'),
  priority: z.enum(['高', '中', '低']),
  status: z.enum(['active', 'paused', 'completed']),
})

type FormValues = z.infer<typeof formSchema>

interface EditGoalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: Goal | null
}

export function EditGoalModal({ open, onOpenChange, goal }: EditGoalModalProps) {
  const patchGoal = usePatchGoal()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  })

  useEffect(() => {
    if (!goal) return
    reset({
      title: goal.title,
      icon: goal.icon,
      targetAmount: goal.target_amount,
      savedAmount: goal.saved_amount,
      monthlySaving: goal.monthly_saving,
      targetYear: goal.target_year,
      priority: goal.priority,
      status: goal.status,
    })
  }, [goal, reset])

  const onSubmit = async (values: FormValues) => {
    if (!goal) return

    await patchGoal.mutateAsync({
      id: goal.id,
      body: {
        title: values.title,
        icon: values.icon,
        target_amount: values.targetAmount,
        saved_amount: values.savedAmount,
        monthly_saving: values.monthlySaving,
        target_year: values.targetYear,
        priority: values.priority,
        status: values.status,
      },
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>目標を編集</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form id="edit-goal-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-xs text-text2">タイトル</label>
              <Input {...register('title')} />
              {errors.title ? <p className="text-xs text-danger">{errors.title.message}</p> : null}
            </div>
            <div>
              <label className="text-xs text-text2">アイコン</label>
              <Input {...register('icon')} maxLength={2} />
              {errors.icon ? <p className="text-xs text-danger">{errors.icon.message}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text2">目標金額</label>
                <Input type="number" {...register('targetAmount', { valueAsNumber: true })} />
                {errors.targetAmount ? <p className="text-xs text-danger">{errors.targetAmount.message}</p> : null}
              </div>
              <div>
                <label className="text-xs text-text2">現在貯蓄額</label>
                <Input type="number" {...register('savedAmount', { valueAsNumber: true })} />
                {errors.savedAmount ? <p className="text-xs text-danger">{errors.savedAmount.message}</p> : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text2">月次積立額</label>
                <Input type="number" {...register('monthlySaving', { valueAsNumber: true })} />
                {errors.monthlySaving ? <p className="text-xs text-danger">{errors.monthlySaving.message}</p> : null}
              </div>
              <div>
                <label className="text-xs text-text2">目標年</label>
                <Input type="number" {...register('targetYear', { valueAsNumber: true })} />
                {errors.targetYear ? <p className="text-xs text-danger">{errors.targetYear.message}</p> : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text2">優先度</label>
                <Select {...register('priority')}>
                  <option value="高">高</option>
                  <option value="中">中</option>
                  <option value="低">低</option>
                </Select>
              </div>
              <div>
                <label className="text-xs text-text2">ステータス</label>
                <Select {...register('status')}>
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="completed">completed</option>
                </Select>
              </div>
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={patchGoal.isPending}>
            キャンセル
          </Button>
          <Button type="submit" form="edit-goal-form" disabled={patchGoal.isPending || !goal}>
            {patchGoal.isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
