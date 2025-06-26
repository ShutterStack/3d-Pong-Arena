'use server';

/**
 * @fileOverview Implements dynamic difficulty adjustment for the 3D Pong game.
 *
 * - adjustDifficulty - Adjusts game difficulty based on player performance.
 * - DifficultyAdjustmentInput - Input type for the adjustDifficulty function.
 * - DifficultyAdjustmentOutput - Return type for the adjustDifficulty function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DifficultyAdjustmentInputSchema = z.object({
  playerScore: z.number().describe("The player's current score."),
  opponentScore: z.number().describe("The opponent's current score."),
  gameTimeElapsed: z.number().describe('The time elapsed in the current game (in seconds).'),
});
export type DifficultyAdjustmentInput = z.infer<typeof DifficultyAdjustmentInputSchema>;

const DifficultyAdjustmentOutputSchema = z.object({
  ballSpeedMultiplier: z
    .number()
    .describe('Multiplier for the ball speed (e.g., 1.0 for normal speed, 1.2 for faster).'),
  ballAngleRandomness: z
    .number()
    .describe('Adjustments to the ball angle randomness (e.g. 0.1 for slight variation, 0.5 for high variation).'),
  paddleSizeMultiplier: z
    .number()
    .describe('Multiplier for the paddle size (e.g., 1.0 for normal size, 0.9 for smaller paddle).'),
  opponentSpeedMultiplier: z
    .number()
    .describe("Multiplier for the opponent's paddle speed (e.g., 1.0 for normal, 1.2 for faster)."),
});
export type DifficultyAdjustmentOutput = z.infer<typeof DifficultyAdjustmentOutputSchema>;

export async function adjustDifficulty(input: DifficultyAdjustmentInput): Promise<DifficultyAdjustmentOutput> {
  return adjustDifficultyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adjustDifficultyPrompt',
  input: {schema: DifficultyAdjustmentInputSchema},
  output: {schema: DifficultyAdjustmentOutputSchema},
  prompt: `You are an AI game difficulty tuner for a 3D Pong game. Your goal is to dynamically adjust the game difficulty based on the player's performance, 
making the game challenging and engaging without being too easy or too hard. 

Use the following game data to determine difficulty adjustments:

Player Score: {{{playerScore}}}
Opponent Score: {{{opponentScore}}}
Game Time Elapsed: {{{gameTimeElapsed}}} seconds

Consider these factors when adjusting difficulty:
- If the player is significantly ahead, increase the ball speed, angle randomness, and the opponent's paddle speed. Slightly reduce the player's paddle size.
- If the player is significantly behind, decrease the ball speed, angle randomness, and the opponent's paddle speed. Slightly increase the player's paddle size.
- As the game progresses (time elapsed increases), gradually increase the overall difficulty, including opponent speed.

Output the adjustments as JSON with the following fields:
- ballSpeedMultiplier: Multiplier for the ball speed (e.g., 1.0 for normal speed, 1.2 for faster).
- ballAngleRandomness: Adjustments to the ball angle randomness (e.g. 0.1 for slight variation, 0.5 for high variation).
- paddleSizeMultiplier: Multiplier for the paddle size (e.g., 1.0 for normal size, 0.9 for smaller paddle).
- opponentSpeedMultiplier: Multiplier for the opponent's paddle speed (e.g., 1.0 for normal, 1.2 for faster).`,
});

const adjustDifficultyFlow = ai.defineFlow(
  {
    name: 'adjustDifficultyFlow',
    inputSchema: DifficultyAdjustmentInputSchema,
    outputSchema: DifficultyAdjustmentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
