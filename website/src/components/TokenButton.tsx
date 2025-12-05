import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Key, LogOut, CheckCircle } from "lucide-react";
import { githubService } from "../services/githubAPI";
import { TokenSetup } from "./TokenSetup";
import { toast } from "sonner";

export function TokenButton() {
  const [hasToken, setHasToken] = useState(githubService.hasToken());
  const [showSetup, setShowSetup] = useState(false);

  const handleRemoveToken = () => {
    githubService.removeToken();
    setHasToken(false);
    toast.success("Token removed successfully");
  };

  const handleTokenSaved = () => {
    setHasToken(true);
    toast.success("Token saved successfully");
  };

  if (!hasToken) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSetup(true)}
        >
          <Key className="h-4 w-4 mr-2" />
          Setup Token
        </Button>
        <TokenSetup
          open={showSetup}
          onOpenChange={setShowSetup}
          onTokenSaved={handleTokenSaved}
        />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            Authenticated
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowSetup(true)}>
            <Key className="h-4 w-4 mr-2" />
            Update Token
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleRemoveToken}>
            <LogOut className="h-4 w-4 mr-2" />
            Remove Token
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TokenSetup
        open={showSetup}
        onOpenChange={setShowSetup}
        onTokenSaved={handleTokenSaved}
      />
    </>
  );
}

