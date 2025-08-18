// 'use client'

// import { Button } from '@/components/ui/button'
// import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
// import { Input } from '@/components/ui/input'
// import Useproject from '@/hooks/use-project'
// import React from 'react'
// import { toast } from 'sonner'

// const InviteButton = () => {
//     const [open, setOpen] = React.useState(false);
//     const {projectId} = Useproject();
//   return (
//     <>
//     <Dialog open={open}>
//         <DialogContent>
//             <DialogHeader>
//                 <p className='text-sm text-gray-500'>
//                     Ask them to copy this link to join the project:
//                 </p>
//                 <Input
//                 className='mt-4'
//                 readOnly
//                 onClick={() => {
//                     navigator.clipboard.writeText(`${window.location.origin}/join/${projectId}`);
//                     toast.success('Invite link copied to clipboard!');
//                 }}
//                 value={`${window.location.origin}/join/${projectId}`}
//                 >
//                 </Input>
//             </DialogHeader>
//         </DialogContent>
//     </Dialog>
//     <Button size='sm' onClick={() => setOpen(true)}>Invite</Button>
//     </>
//   )
// }

// export default InviteButton

'use client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Copy } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

type Props = {
    projectId?: string
}

const InviteButton = ({projectId}: Props) => {
    const [inviteUrl, setInviteUrl] = React.useState(''); // ✅ State for invite URL

    // ✅ Set URL on client side only
    React.useEffect(() => {
        setInviteUrl(`${window.location.origin}/join/${projectId}`);
    }, [projectId]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(inviteUrl);
        toast.success('Invite link copied to clipboard!');
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-2" />
                    Invite members
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invite members to your project</DialogTitle>
                    <p>Share this link with your team members to join the project.</p>
                    <div className="flex items-center gap-2 mt-4">
                        <Input
                            className="flex-1"
                            readOnly
                            onClick={copyToClipboard}
                            value={inviteUrl} // ✅ Use state value
                            placeholder="Loading invite link..."
                        />
                        <Button onClick={copyToClipboard} size="sm">
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}

export default InviteButton