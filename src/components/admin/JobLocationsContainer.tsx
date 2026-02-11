"use client";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { APP_CONSTANTS } from "@/lib/constants";
import { JobLocation } from "@/models/job.model";
import JobLocationsTable from "./JobLocationsTable";
import EditLocationDialog from "./EditLocationDialog";
import MergeLocationDialog from "./MergeLocationDialog";
import {
  getAllJobLocations,
  getJobLocationById,
  getJobLocationsList,
} from "@/actions/jobLocation.actions";
import Loading from "../Loading";
import { Button } from "../ui/button";
import { RecordsPerPageSelector } from "../RecordsPerPageSelector";
import { RecordsCount } from "../RecordsCount";

function JobLocationsContainer() {
  const [locations, setLocations] = useState<JobLocation[]>([]);
  const [totalJobLocations, setTotalJobLocations] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(
    APP_CONSTANTS.RECORDS_PER_PAGE,
  );

  // Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLocation, setEditLocation] = useState<JobLocation | null>(null);

  // Merge dialog state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSourceLocation, setMergeSourceLocation] =
    useState<JobLocation | null>(null);
  const [allLocations, setAllLocations] = useState<JobLocation[]>([]);

  const loadJobLocations = useCallback(
    async (page: number) => {
      setLoading(true);
      const { data, total } = await getJobLocationsList(
        page,
        recordsPerPage,
        "count"
      );
      if (data) {
        setLocations((prev) => (page === 1 ? data : [...prev, ...data]));
        setTotalJobLocations(total);
        setPage(page);
        setLoading(false);
      }
    },
    [recordsPerPage]
  );

  const reloadJobLocations = useCallback(async () => {
    await loadJobLocations(1);
  }, [loadJobLocations]);

  const resetEditLocation = () => {
    setEditLocation(null);
  };

  useEffect(() => {
    (async () => await loadJobLocations(1))();
  }, [loadJobLocations, recordsPerPage]);

  const onEditLocation = async (locationId: string) => {
    const location = await getJobLocationById(locationId);
    setEditLocation(location);
    setDialogOpen(true);
  };

  const onMergeLocation = async (location: JobLocation) => {
    setMergeSourceLocation(location);
    const all = await getAllJobLocations();
    setAllLocations(all ?? []);
    setMergeDialogOpen(true);
  };

  return (
    <>
      <div className="col-span-3">
        <Card x-chunk="dashboard-06-chunk-0">
          <CardHeader className="flex-row justify-between items-center">
            <CardTitle>Job Locations</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <Loading />}
            {locations.length > 0 && (
              <>
                <JobLocationsTable
                  jobLocations={locations}
                  reloadJobLocations={reloadJobLocations}
                  editLocation={onEditLocation}
                  onMergeLocation={onMergeLocation}
                />
                <div className="flex items-center justify-between mt-4">
                  <RecordsCount
                    count={locations.length}
                    total={totalJobLocations}
                    label="job locations"
                  />
                  {totalJobLocations > APP_CONSTANTS.RECORDS_PER_PAGE && (
                    <RecordsPerPageSelector
                      value={recordsPerPage}
                      onChange={setRecordsPerPage}
                    />
                  )}
                </div>
              </>
            )}
            {locations.length < totalJobLocations && (
              <div className="flex justify-center p-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadJobLocations(page + 1)}
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EditLocationDialog
        editLocation={editLocation}
        reloadLocations={reloadJobLocations}
        resetEditLocation={resetEditLocation}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
      />

      <MergeLocationDialog
        sourceLocation={mergeSourceLocation}
        allLocations={allLocations}
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        onMergeComplete={reloadJobLocations}
      />
    </>
  );
}

export default JobLocationsContainer;
