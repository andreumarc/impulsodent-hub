interface BrandLogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  subtitle?: string
}

const SIZES = { sm: '1.1rem', md: '1.35rem', lg: '1.55rem' }

export function BrandLogo({ variant = 'dark', size = 'md', subtitle }: BrandLogoProps) {
  return (
    <div className="flex flex-col leading-none">
      <span style={{ fontSize: SIZES[size], fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
        <span style={{ color: variant === 'light' ? '#ffffff' : '#003A70' }}>Impulso</span>
        <span style={{ color: variant === 'light' ? '#26c6bf' : '#00A99D' }}>Dent</span>
      </span>
      {subtitle && (
        <span
          className="text-[11px] font-medium mt-0.5"
          style={{ color: variant === 'light' ? 'rgba(255,255,255,0.45)' : '#9ca3af' }}
        >
          {subtitle}
        </span>
      )}
    </div>
  )
}
