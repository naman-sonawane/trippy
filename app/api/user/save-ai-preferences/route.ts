// app/api/user/save-ai-preferences/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { age, budget, walk, dayNight, soloGroup } = body;

        console.log('💾 Saving AI-collected preferences for user:', session.user.email);
        console.log('📋 Raw preferences:', { age, budget, walk, dayNight, soloGroup });

        // Convert soloGroup string to boolean for the solo field
        let soloValue: boolean | undefined = undefined;
        if (soloGroup && soloGroup !== "Not mentioned") {
            // "Solo" = true, anything else (With Partner, With Family, With Friends, Group) = false
            soloValue = soloGroup.toLowerCase().trim() === "solo";
        }

        // Convert age string to number
        let ageValue: number | undefined = undefined;
        if (age && age !== "Not mentioned") {
            const parsedAge = parseInt(age);
            if (!isNaN(parsedAge)) {
                ageValue = parsedAge;
            }
        }

        await connectDB();

        // Prepare update object - only include fields that have valid values
        const updateData: any = {};

        if (ageValue !== undefined) {
            updateData.age = ageValue;
        }
        if (budget && budget !== "Not mentioned") {
            updateData.budget = budget;
        }
        if (walk && walk !== "Not mentioned") {
            updateData.walk = walk;
        }
        if (dayNight && dayNight !== "Not mentioned") {
            updateData.dayNight = dayNight;
        }
        if (soloValue !== undefined) {
            updateData.solo = soloValue;
        }

        console.log('📝 Processed update data:', updateData);

        // Update user with AI-collected preferences
        const updatedUser = await User.findOneAndUpdate(
            { email: session.user.email },
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        console.log('✅ Preferences saved successfully');

        return NextResponse.json({
            success: true,
            user: {
                age: updatedUser.age,
                budget: updatedUser.budget,
                walk: updatedUser.walk,
                dayNight: updatedUser.dayNight,
                solo: updatedUser.solo,
            },
            savedFields: Object.keys(updateData)
        }, { status: 200 });

    } catch (error) {
        console.error('❌ Error saving AI preferences:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}