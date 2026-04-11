import { useTradingStore } from '../../stores/tradingStore';
import { useAccount } from '../../contexts/AccountContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Trophy, Coins, Sparkles, Info } from 'lucide-react';

const DerivPoints = () => {
  const { derivPoints: totalPoints, convertDerivPoints: convertPoints } = useTradingStore();
  const { balance: accountBalance, updateBalance, accountType } = useAccount();
  
  const handleConvert = () => {
    if (totalPoints >= 100) {
      // Convert ALL available dollars at once
      const pointsToConvert = availableDollars * 100;
      const cashAmount = convertPoints(pointsToConvert);
      if (cashAmount > 0) {
        // Update account balance with the converted cash
        updateBalance(accountBalance + cashAmount);
      }
    }
  };

  // Calculate progress to next dollar
  const pointsInCurrentCycle = totalPoints % 100;
  const progressPercentage = (pointsInCurrentCycle / 100) * 100;
  const availableDollars = Math.floor(totalPoints / 100);
  const canConvert = totalPoints >= 100;

  return (
    <Card className="mb-4 relative overflow-hidden border-amber-500/20 bg-gradient-to-br from-card via-card to-amber-950/10">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent pointer-events-none" />
      
      <CardHeader className="pb-3 relative">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400">
            <Trophy className="h-4 w-4" />
          </div>
          <span className="text-amber-400 font-bold">
            Deriv Rewards Points
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3 relative">
        {/* Points Display with Redeem Button */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-amber-500/10">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-xs text-muted-foreground">Total Points</p>
              <p className="text-2xl font-bold text-amber-400 tabular-nums">{totalPoints}</p>
            </div>
          </div>
          
          {/* Redeem Button - In same row */}
          <Button 
            onClick={handleConvert}
            disabled={!canConvert}
            className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-muted disabled:to-muted disabled:opacity-50 disabled:text-foreground text-white font-semibold shadow-lg shadow-amber-500/20 transition-all duration-200 shrink-0"
            size="sm"
            aria-label="Convert points to cash"
          >
            <Coins className="h-4 w-4 mr-1.5" />
            {canConvert 
              ? `Redeem $${availableDollars}`
              : `Need ${100 - pointsInCurrentCycle}`
            }
          </Button>
        </div>

        {/* Available Display - Below button */}
        {availableDollars > 0 && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-profit/10 border border-profit/20">
            <span className="text-xs text-muted-foreground">Available to redeem</span>
            <p className="text-lg font-bold text-profit flex items-center gap-1">
              <Coins className="h-4 w-4" />
              ${availableDollars}.00
            </p>
          </div>
        )}

        {/* Progress Bar to Next Dollar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress to next $1</span>
            <span className="font-mono text-amber-400">{pointsInCurrentCycle}/100</span>
          </div>
          <div className="h-2 bg-muted/50 rounded-full overflow-hidden border border-amber-500/20">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500 ease-out relative"
              style={{ width: `${progressPercentage}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">How it works:</span> Earn 1 point for every $1 wagered on trades (win or lose)
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Redemption:</span> Every 100 points = $1 cash ({accountType === "demo" ? "demo" : "real"} balance)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DerivPoints;
