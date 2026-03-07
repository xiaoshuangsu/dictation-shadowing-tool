// Dynamic routes - placeholder page for static export
// Client-side handles the actual navigation

export async function generateStaticParams() {
  return [{ slug: 'placeholder' }]
}

export default function ShadowingPracticePage() {
  return (
    <div className="p-4 text-center">
      <h1 className="text-xl font-bold mb-4">Shadowing Practice</h1>
      <p>Please return to the <a href="/topics" className="text-blue-500 underline">topics page</a> to select a material.</p>
      <script dangerouslySetInnerHTML={{
        __html: `window.location.href = '/topics';`
      }} />
    </div>
  )
}
