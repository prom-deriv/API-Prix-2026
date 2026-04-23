import { useAccount } from '../../contexts/AccountContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Gift, ExternalLink, Star } from 'lucide-react';

const DerivGiftCard = () => {
  const { accountType } = useAccount();
  const isRealAccount = accountType === 'real';

  const handlePurchase = () => {
    // Open Deriv Cashier in a new tab
    window.open('https://app.deriv.com/cashier', '_blank');
  };

  return (
    <Card className="h-full flex flex-col relative overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-3 relative">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#D4AF37]/20 text-[#D4AF37]">
            <Gift className="h-4 w-4" />
          </div>
          <span className="font-bold text-[#D4AF37]">
            Deriv Digital Gift Card
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4 relative flex-1 flex flex-col">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Image Section */}
          <div className="flex-shrink-0 w-full md:w-1/3 flex items-center justify-center">
            <div className="relative group overflow-hidden rounded-xl shadow-lg border border-primary/20 transition-transform duration-300 hover:scale-[1.02]">
              <img 
                src="/Gift Card/Deriv Gift Card.png" 
                alt="Deriv Digital Gift Card" 
                className="w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 flex flex-col justify-between space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Deriv Digital Gift Card is a unique, high-value asset that bridges the gap between traditional gifting and the world of financial markets. Whether you are looking to reward a loyal client, support a friend's trading journey, or send a meaningful "Season's Greeting," this card offers a "VIP" experience.
            </p>
            
            <ul className="space-y-2 text-sm text-foreground/80">
              <li className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500 shrink-0" />
                <span>The Perfect Gateway for New Traders</span>
              </li>
              <li className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500 shrink-0" />
                <span>A Premium Business Tool for Partners & Clients</span>
              </li>
              <li className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500 shrink-0" />
                <span>Rewarding Performance in Trading Communities</span>
              </li>
              <li className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500 shrink-0" />
                <span>Meaningful Season's Greetings & Special Occasions</span>
              </li>
            </ul>

            <div className="pt-2">
              <Button 
                onClick={handlePurchase}
                disabled={!isRealAccount}
                className="w-full md:w-auto bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all duration-200"
                size="lg"
              >
                Purchase Gift Card
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
              {!isRealAccount && (
                <p className="text-xs text-muted-foreground mt-2 text-center md:text-left">
                  * Please switch to a real account to purchase.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* VIP Summary Box */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10 mt-auto">
          <div className="space-y-1 text-sm">
            <p className="text-foreground/90">
              <span className="font-bold text-primary">VIP Summary:</span> Purchasing a Deriv Digital Gift Card isn't just about the money on the card; it's about gifting financial empowerment. It tells your recipient that you value their growth and want them to succeed in the global marketplace.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DerivGiftCard;
