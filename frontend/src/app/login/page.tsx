'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  )
  const [errorMsg, setErrorMsg] = useState('')

  // 다른 탭(이메일 링크 클릭한 새 탭)에서 인증되면 이 탭도 자동 이동
  useEffect(() => {
    const supabase = createClient()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) router.replace('/clones')
        })
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold">로그인</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          이메일로 매직링크를 받아 로그인하세요.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status === 'sending' || status === 'sent'}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={status === 'sending' || status === 'sent'}
          >
            {status === 'sending' ? '전송 중...' : '매직링크 보내기'}
          </Button>

          {status === 'sent' && (
            <div className="space-y-1 text-sm text-green-600">
              <p>✓ {email} 로 매직링크를 보냈습니다.</p>
              <p className="text-xs text-muted-foreground">
                메일의 링크를 누르면 이 창이 자동으로 이동합니다. 새로 열린 탭은 닫아도 됩니다.
              </p>
            </div>
          )}

          {status === 'error' && (
            <p className="text-sm text-destructive">✗ {errorMsg}</p>
          )}
        </form>
      </Card>
    </main>
  )
}
