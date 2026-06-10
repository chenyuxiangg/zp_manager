import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export default dayjs

export function formatRelative(date) {
  if (!date) return ''
  return dayjs(date).fromNow()
}

export function formatDate(date, format = 'YYYY-MM-DD') {
  if (!date) return ''
  return dayjs(date).format(format)
}

export function formatDateTime(date) {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}