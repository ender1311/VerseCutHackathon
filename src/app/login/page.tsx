import { config } from '@/config';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel px-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <img
            src={config.brand.logoPath}
            alt=""
            className="h-12 w-12 rounded-[14px]"
          />
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-ink">
              {config.brand.name}
            </h1>
            <p className="mt-1 text-[13px] text-muted">{config.brand.tagline}</p>
          </div>
        </div>

        {error && (
          <p className="mt-5 rounded-lg border border-brand/20 bg-brand/5 px-4 py-3 text-center text-[13px] text-brand">
            {error === 'unauthorized'
              ? 'Access is limited to YouVersion accounts. Sign in with your YouVersion email.'
              : 'Sign in failed. Please try again.'}
          </p>
        )}

        <a
          href="/login/start"
          className="mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-brand text-[15px] font-bold text-white shadow-[0_8px_24px_-6px_rgba(254,55,69,0.6)] transition hover:bg-brand-strong"
        >
          Sign in with YouVersion
        </a>
      </div>
    </div>
  );
}
