import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type TeamMemberCardProps = {
  name: string;
  role: string;
  imageSrc: string;
  imageAlt: string;
  dialogTitle?: string;
  dialogDescription?: string;
  children: React.ReactNode;
};

export function TeamMemberCard({
  name,
  role,
  imageSrc,
  imageAlt,
  dialogTitle,
  dialogDescription,
  children,
}: TeamMemberCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{role}</CardDescription>
      </CardHeader>

      <CardContent className="flex items-center justify-center">
        <img
          src={imageSrc}
          width={256}
          height={256}
          alt={imageAlt}
          className="h-48 w-48 rounded-xl object-cover"
          loading="lazy"
        />
      </CardContent>

      <CardFooter className="justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Learn more</Button>
          </DialogTrigger>

          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{dialogTitle ?? name}</DialogTitle>
              <DialogDescription>{dialogDescription ?? role}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">{children}</div>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}
