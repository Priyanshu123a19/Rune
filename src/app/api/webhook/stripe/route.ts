// api/webhok/stripe

import { db } from "@/server/db";
import { NextRequest, NextResponse } from "next/server";
import  Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-07-30.basil", // ✅ Updated to match your Stripe package
});

export async function POST(request:Request){
    const body= await request.text();
    const signature = request.headers.get("stripe-signature") as string;

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET as string)
    } catch (error: any) {
       return NextResponse.json(
           { error: `Webhook Error: ${error.message}` },
           { status: 400 }
       );
    }

    const session = event.data.object as Stripe.Checkout.Session;

    console.log(event.type)

    if(event.type === "checkout.session.completed"){
        const credits = Number(session.metadata?.['credits']);
        const userId= session.client_reference_id;
        if(!userId) {
            return NextResponse.json(
                { error: "Missing user ID" },
                { status: 400 }
            );
        }

        await db.stripeTransaction.create({
            data: {
                userId,
                credits
            },
        });

        await db.user.update({
            where: { id: userId },
            data: { credits: { increment: credits } },
        });

        return NextResponse.json({message: 'credits added successfully'}, {status:200});
    }
    return NextResponse.json({message: 'hello world'});
}