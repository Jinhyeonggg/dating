'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  )
  const [errorMsg, setErrorMsg] = useState('')

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
            <p className="text-sm text-green-600">
              ✓ {email} 로 매직링크를 보냈습니다. 이메일을 확인하세요.
            </p>
          )}

          {status === 'error' && (
            <p className="text-sm text-destructive">✗ {errorMsg}</p>
          )}
        </form>
      </Card>
    </main>
  )
}
