// 'use client'
// import { Button } from '@/components/ui/button'
// import { Slider } from '@/components/ui/slider'
// import { createCheckoutSession } from '@/lib/stripe'
// import { api } from '@/trpc/react'
// import { Info } from 'lucide-react'
// import React from 'react'

// const page = () => {
//     const {data: user}= api.project.getMyCredits.useQuery()
//     const [creditsToBuy, setCreditsToBuy] = React.useState<number[]>([100])
//     const creditsToBuyAmount= creditsToBuy[0]!
//     const price = (creditsToBuyAmount /50).toFixed(2);

//   return (
//     <div>
//         <h1 className='text-xl font-semibold'>
//             Billing
//         </h1>
//         <div className='h-2'></div>
//         <p className='text-sm text-gray-500'>
//             you currently have {user?.credits} Runes
//         </p>
//         <div className='h-2'></div>
//         <div className='bg-blue-50 px-4 py-2 rounded-md border border-blue-200 text-blue-700'>
//             <div className='flex items-center gap-2'>
//                 <Info className='size-4' />
//                 <p className='text-sm'>Each Rune allows you to index 1 file in the repository</p>
//             </div>
//             <p className='text-sm'>Eg if your project has 10 files, you will need 10 Runes to index them all.</p>
//         </div>
//         <div className='h-4'></div>
//         <Slider defaultValue={[100]} max={1000} min={10} step={10} onValueChange={value=>setCreditsToBuy(value)} value={creditsToBuy}/>
//             <div className='h-4'></div>
//             <Button onClick={()=> {
//                 createCheckoutSession(creditsToBuyAmount)
//             }}>
//                 Buy {creditsToBuyAmount} Runes for ${price}
//             </Button>
//     </div>
//   )
// }

// export default page

'use client'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { createCheckoutSession } from '@/lib/stripe'
import { api } from '@/trpc/react'
import { Info } from 'lucide-react'
import React from 'react'

const page = () => {
    const {data: user}= api.project.getMyCredits.useQuery()
    const [creditsToBuy, setCreditsToBuy] = React.useState<number[]>([100])
    const creditsToBuyAmount= creditsToBuy[0]!
    
    // ✅ USD to INR conversion (approximate rate: 1 USD = 83 INR)
    const USD_TO_INR = 83;
    const priceUSD = (creditsToBuyAmount / 50);
    const priceINR = (priceUSD * USD_TO_INR).toFixed(2);

  return (
    <div>
        <h1 className='text-xl font-semibold'>
            Billing
        </h1>
        <div className='h-2'></div>
        <p className='text-sm text-gray-500'>
            you currently have {user?.credits} Runes
        </p>
        <div className='h-2'></div>
        <div className='bg-blue-50 px-4 py-2 rounded-md border border-blue-200 text-blue-700'>
            <div className='flex items-center gap-2'>
                <Info className='size-4' />
                <p className='text-sm'>Each Rune allows you to index 1 file in the repository</p>
            </div>
            <p className='text-sm'>Eg if your project has 10 files, you will need 10 Runes to index them all.</p>
        </div>
        <div className='h-4'></div>
        
        {/* ✅ Display both USD and INR prices */}
        <div className='mb-4 p-3 bg-gray-50 rounded-lg border'>
            <div className='text-sm text-gray-600 mb-1'>Price for {creditsToBuyAmount} Runes:</div>
            <div className='flex items-center gap-4'>
                <span className='text-lg font-semibold text-green-600'>₹{priceINR}</span>
                <span className='text-sm text-gray-500'>(≈ ${priceUSD.toFixed(2)} USD)</span>
            </div>
        </div>

        <Slider 
            defaultValue={[100]} 
            max={1000} 
            min={10} 
            step={10} 
            onValueChange={value=>setCreditsToBuy(value)} 
            value={creditsToBuy}
        />
        
        <div className='h-4'></div>
        
        <Button onClick={()=> {
            createCheckoutSession(creditsToBuyAmount)
        }}>
            Buy {creditsToBuyAmount} Runes for ₹{priceINR} {/* ✅ Show INR price */}
        </Button>
        
        {/* ✅ Exchange rate disclaimer */}
        <p className='text-xs text-gray-400 mt-2'>
            *Exchange rate: 1 USD = ₹{USD_TO_INR} (approximate)
        </p>
    </div>
  )
}

export default page