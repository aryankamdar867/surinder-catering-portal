import Badge from '@/components/ui/Badge.jsx'
import { ENQUIRY_STATUS } from '@/constants/enquiry.js'

export default function EnquiryStatusBadge({ status, className }) {
  const meta = ENQUIRY_STATUS[status] ?? { label: status, tone: 'neutral' }
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  )
}
