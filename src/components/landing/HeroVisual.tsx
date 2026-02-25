export default function HeroVisual() {
  return (
    <div
      className="relative w-full max-w-xl mx-auto flex items-center justify-center animate-fade-in"
      style={{ maxHeight: '450px' }}
    >
      {/* 浅蓝渐变背景 */}
      <div
        className="absolute inset-0 rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 50%, #DDD6FE 100%)',
          opacity: 0.3,
        }}
      />

      {/* 浮动动画容器 - 使用 CSS 动画代替 Framer Motion */}
      <div className="relative animate-float">
        <img
          src="hero-banner.png"
          alt="Improve English listening and speaking skills with ShadowHub"
          width={960}
          height={960}
          className="relative w-full h-auto"
          style={{ maxHeight: '400px', objectFit: 'contain' }}
        />
      </div>
    </div>
  )
}
