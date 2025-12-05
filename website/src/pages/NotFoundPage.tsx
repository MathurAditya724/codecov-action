import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <CardTitle>Page Not Found</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            The page you're looking for doesn't exist or the repository cannot be found.
          </p>
          <p className="text-sm text-muted-foreground">
            To view a repository's coverage dashboard, navigate to:
          </p>
          <code className="block mt-2 p-2 bg-muted rounded text-sm">
            /:owner/:repo
          </code>
          <p className="text-sm text-muted-foreground mt-4">
            Example:{" "}
            <Link 
              to="/mathuraditya724/codecov-action" 
              className="text-primary hover:underline"
            >
              /mathuraditya724/codecov-action
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

