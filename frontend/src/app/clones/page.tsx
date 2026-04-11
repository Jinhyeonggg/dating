import { createClient } from '@/lib/supabase/server'

export default async function ClonesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold">Clones</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          로그인됨: {user?.email ?? '(unknown)'}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Plan 3에서 Clone 목록·생성 UI가 여기에 채워집니다.
        </p>
      </div>
    </main>
  )
}
