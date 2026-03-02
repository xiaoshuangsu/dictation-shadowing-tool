import { useMemo } from "react"
import { useLanguage } from "@/contexts/LanguageContext"

export function useLocalizedPath() {
  const { language } = useLanguage()

  const getLocalizedPath = useMemo(() => {
    return (path: string): string => {
      // 中文是默认/权威语言，不加前缀；英文加 /en 前缀
      if (language === "en") {
        return `/en${path === "/" ? "" : path}`
      }
      return path
    }
  }, [language])

  return { getLocalizedPath }
}
