'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useCreateGoal } from '@/hooks/useGoals'

const formSchema = z.object({
  title: z.string().min(1, 'タイトルを入力してください').max(50, 'タイトルは50文字以内で入力してください'),
  icon: z.string().min(1, 'アイコンを入力してください').max(2, 'アイコンは1文字で入力してください'),
  targetAmount: z.number({ invalid_type_error: '目標金額を入力してください' }).min(1, '1円以上を入力してください'),
  savedAmount: z.number({ invalid_type_error: '現在貯蓄額を入力してください' }).min(0, '0円以上を入力してください'),
  targetYear: z.number({ invalid_type_error: '目標年を入力してください' }).min(new Date().getFullYear(), '今年以降を入力してください'),
  monthlySaving: z.number({ invalid_type_error: '月次積立を入力してください' }).min(0, '0円以上を入力してください'),
  priority: z.enum(['高', '中', '低']),
})

type FormValues = z.infer<typeof formSchema>

interface AddGoalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddGoalModal({ open, onOpenChange }: AddGoalModalProps) {
  const createGoal = useCreateGoal()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      icon: '🎯',
      savedAmount: 0,
      priority: '中',
      targetYear: new Date().getFullYear(),
    },
  })

  const onSubmit = async (values: FormValues) => {
    await createGoal.mutateAsync({
      title: values.title,
      icon: values.icon,
      target_amount: values.targetAmount,
      saved_amount: values.savedAmount,
      monthly_saving: values.monthlySaving,
      target_year: values.targetYear,
      priority: values.priority,
    })

    reset({
      title: '',
      icon: '🎯',
      targetAmount: undefined,
      savedAmount: 0,
      targetYear: new Date().getFullYear(),
      monthlySaving: undefined,
      priority: '中',
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] bg-card">
        <DialogHeader>
          <DialogTitle>目標を追加</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[58vh] py-3">
          <form id="add-goal-form" className="space-y-2.5" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1">
              <label className="text-xs text-text2">タイトル</label>
              <Input {...register('title')} />
              {errors.title ? <p className="text-xs text-danger">{errors.title.message}</p> : null}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text2">アイコン</label>
              <Input {...register('icon')} maxLength={2} />
              {errors.icon ? <p className="text-xs text-danger">{errors.icon.message}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-text2">目標金額</label>
                <Input type="number" {...register('targetAmount', { valueAsNumber: true })} />
                {errors.targetAmount ? <p className="text-xs text-danger">{errors.targetAmount.message}</p> : null}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text2">現在貯蓄額</label>
                <Input type="number" {...register('savedAmount', { valueAsNumber: true })} />
                {errors.savedAmount ? <p className="text-xs text-danger">{errors.savedAmount.message}</p> : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-text2">目標年</label>
                <Input type="number" {...register('targetYear', { valueAsNumber: true })} />
                {errors.targetYear ? <p className="text-xs text-danger">{errors.targetYear.message}</p> : null}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text2">優先度</label>
                <Select {...register('priority')}>
                  <option value="高">高</option>
                  <option value="中">中</option>
                  <option value="低">低</option>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text2">月次積立額</label>
              <Input type="number" {...register('monthlySaving', { valueAsNumber: true })} />
              {errors.monthlySaving ? <p className="text-xs text-danger">{errors.monthlySaving.message}</p> : null}
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={createGoal.isPending}>
            キャンセル
          </Button>
          <Button
            className="bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)]"
            type="submit"
            form="add-goal-form"
            disabled={createGoal.isPending}
          >
            {createGoal.isPending ? '追加中...' : '追加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
